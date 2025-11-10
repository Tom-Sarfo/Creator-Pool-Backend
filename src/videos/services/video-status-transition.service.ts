import { Injectable, Logger, Inject } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  Video,
  VideoStatus,
  VideoVisibility,
} from "../../entities/video.entity";
import { Pool, PoolStatus } from "../../entities/pool.entity";
import { YouTubeService } from "../../youtube/youtube.service";
import { User } from "../../entities/user.entity";

@Injectable()
export class VideoStatusTransitionService {
  private readonly logger = new Logger(VideoStatusTransitionService.name);

  constructor(
    @InjectRepository(Video)
    private videoRepository: Repository<Video>,
    @InjectRepository(Pool)
    private poolRepository: Repository<Pool>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(YouTubeService)
    private youtubeService: YouTubeService
  ) {}

  /**
   * Check for videos that have transitioned from unlisted to public
   * This should be called periodically (every 5-10 minutes)
   */
  async checkVideoStatusTransitions(): Promise<void> {
    this.logger.log("Checking for video status transitions...");

    try {
      // Find videos that are currently marked as unlisted but might have gone public
      const unlistedVideos = await this.videoRepository.find({
        where: {
          status: VideoStatus.UNLISTED,
          visibility: VideoVisibility.UNLISTED,
          hasActivePool: true,
        },
        relations: ["pools"],
      });

      for (const video of unlistedVideos) {
        await this.checkVideoTransition(video);
      }

      this.logger.log(
        `Checked ${unlistedVideos.length} unlisted videos for transitions`
      );
    } catch (error) {
      this.logger.error("Error checking video status transitions:", error);
    }
  }

  /**
   * Check if a specific video has transitioned from unlisted to public
   */
  private async checkVideoTransition(video: Video): Promise<void> {
    try {
      const isNowPublic = await this.checkYouTubeVideoStatus(video);

      if (isNowPublic) {
        await this.transitionVideoToPublic(video);
      }
    } catch (error) {
      this.logger.error(
        `Error checking transition for video ${video.youtubeId}:`,
        error
      );
    }
  }

  /**
   * Check YouTube API to see if video status has changed from unlisted to public
   */
  private async checkYouTubeVideoStatus(video: Video): Promise<boolean> {
    try {
      // Get the creator's YouTube credentials
      const user = await this.userRepository.findOne({
        where: { id: video.creatorId },
        select: [
          "id",
          "youtubeAccessToken",
          "youtubeRefreshToken",
          "youtubeTokenExpiresAt",
        ],
      });

      if (!user || !user.youtubeAccessToken) {
        this.logger.debug(
          `Cannot check status for video ${video.youtubeId}: creator not connected to YouTube`
        );
        return false;
      }

      // Get a valid access token (refresh if needed)
      const accessToken = await this.youtubeService.refreshTokenIfNeeded(user);

      // Call YouTube API to get video status
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=status&id=${video.youtubeId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        this.logger.error(
          `Failed to check video status for ${video.youtubeId}: ${errorData}`
        );
        return false;
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        this.logger.warn(`Video ${video.youtubeId} not found on YouTube`);
        return false;
      }

      const videoStatus = data.items[0].status?.privacyStatus;

      // Check if video is now public
      if (videoStatus === "public") {
        this.logger.log(
          `Video ${video.youtubeId} has transitioned from unlisted to public on YouTube`
        );
        return true;
      }

      return false;
    } catch (error) {
      // Check if error is due to invalid/revoked tokens
      if (
        error instanceof Error &&
        error.message.includes("reconnect your YouTube account")
      ) {
        this.logger.warn(
          `Cannot check status for video ${video.youtubeId}: Creator needs to reconnect YouTube account`
        );
      } else {
        this.logger.error(
          `Error checking YouTube status for video ${video.youtubeId}:`,
          error
        );
      }
      return false;
    }
  }

  /**
   * Transition a video from unlisted to public and update associated pools
   */
  async transitionVideoToPublic(video: Video): Promise<void> {
    this.logger.log(`Transitioning video ${video.youtubeId} to public status`);

    try {
      // Update video status
      const wasUnlisted = video.status === VideoStatus.UNLISTED;
      video.status = VideoStatus.PUBLIC;
      video.visibility = VideoVisibility.PUBLIC;

      // Only set publishedAt if it wasn't already set (don't overwrite if video was previously public)
      if (!video.publishedAt) {
        video.publishedAt = new Date();
      }

      video.lastSyncedAt = new Date();

      await this.videoRepository.save(video);

      // Handle pool transitions for this video
      await this.handlePoolTransitionsForPublicVideo(video);

      this.logger.log(
        `Successfully transitioned video ${video.youtubeId} to public`
      );
    } catch (error) {
      this.logger.error(`Error transitioning video ${video.youtubeId}:`, error);
      throw error;
    }
  }

  /**
   * Handle pool transitions when video goes public
   * Transitions both OPEN and AWAITING_RELEASE pools to LIVE_TRACKING
   */
  private async handlePoolTransitionsForPublicVideo(
    video: Video
  ): Promise<void> {
    // Find all pools for this video that need to transition
    const pools = await this.poolRepository.find({
      where: {
        videoId: video.id,
      },
      relations: ["video"],
    });

    let transitionedCount = 0;

    for (const pool of pools) {
      if (
        pool.status === PoolStatus.OPEN ||
        pool.status === PoolStatus.AWAITING_RELEASE
      ) {
        await this.transitionPoolToLiveTracking(pool);
        transitionedCount++;
      }
    }

    if (transitionedCount > 0) {
      this.logger.log(
        `Transitioned ${transitionedCount} pools to LIVE_TRACKING (video ${video.youtubeId} went public)`
      );
    }
  }

  /**
   * Transition a pool from awaiting_release to live_tracking
   */
  private async transitionPoolToLiveTracking(pool: Pool): Promise<void> {
    this.logger.log(`Transitioning pool ${pool.id} to live tracking`);

    pool.status = PoolStatus.LIVE_TRACKING;
    pool.publishedAt = new Date();
    pool.trackingStartedAt = new Date();

    await this.poolRepository.save(pool);

    this.logger.log(`Pool ${pool.id} is now live tracking`);
  }

  /**
   * Manually transition a video to public (for testing or manual intervention)
   */
  async manuallyTransitionVideoToPublic(videoId: string): Promise<void> {
    const video = await this.videoRepository.findOne({
      where: { id: videoId },
      relations: ["pools"],
    });

    if (!video) {
      throw new Error(`Video with ID ${videoId} not found`);
    }

    if (!video.isUnlisted()) {
      throw new Error(`Video ${videoId} is not in unlisted status`);
    }

    await this.transitionVideoToPublic(video);
  }

  /**
   * Get videos that are ready for status transition checks`
   */
  async getVideosForStatusCheck(): Promise<Video[]> {
    return this.videoRepository.find({
      where: {
        status: VideoStatus.UNLISTED,
        visibility: VideoVisibility.UNLISTED,
        hasActivePool: true,
      },
      relations: ["pools", "creator"],
      order: {
        createdAt: "ASC",
      },
    });
  }

  /**
   * Get pools that are awaiting video publication
   */
  async getPoolsAwaitingRelease(): Promise<Pool[]> {
    return this.poolRepository.find({
      where: {
        status: PoolStatus.AWAITING_RELEASE,
      },
      relations: ["video", "creator"],
      order: {
        createdAt: "ASC",
      },
    });
  }
}
