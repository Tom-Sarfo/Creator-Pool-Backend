import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  Video,
  VideoStatus,
  VideoVisibility,
} from "../../entities/video.entity";
import { Pool, PoolStatus } from "../../entities/pool.entity";

@Injectable()
export class VideoStatusTransitionService {
  private readonly logger = new Logger(VideoStatusTransitionService.name);

  constructor(
    @InjectRepository(Video)
    private videoRepository: Repository<Video>,
    @InjectRepository(Pool)
    private poolRepository: Repository<Pool>
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
      // In a real implementation, you would call YouTube API here
      // For now, we'll simulate the check
      const isNowPublic = await this.checkYouTubeVideoStatus(video.youtubeId);

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
   * Simulate YouTube API call to check video status
   * In production, this would call the actual YouTube Data API
   */
  private async checkYouTubeVideoStatus(youtubeId: string): Promise<boolean> {
    // TODO: Implement actual YouTube API call
    // For now, return false to prevent automatic transitions in development
    this.logger.debug(`Checking YouTube status for video: ${youtubeId}`);
    return false;
  }

  /**
   * Transition a video from unlisted to public and update associated pools
   */
  async transitionVideoToPublic(video: Video): Promise<void> {
    this.logger.log(`Transitioning video ${video.youtubeId} to public status`);

    try {
      // Update video status
      video.status = VideoStatus.PUBLIC;
      video.visibility = VideoVisibility.PUBLIC;
      video.publishedAt = new Date();
      video.lastSyncedAt = new Date();

      await this.videoRepository.save(video);

      // Update associated pools
      const pools = await this.poolRepository.find({
        where: {
          videoId: video.id,
          status: PoolStatus.AWAITING_RELEASE,
        },
      });

      for (const pool of pools) {
        await this.transitionPoolToLiveTracking(pool);
      }

      this.logger.log(
        `Successfully transitioned video ${video.youtubeId} and ${pools.length} pools`
      );
    } catch (error) {
      this.logger.error(`Error transitioning video ${video.youtubeId}:`, error);
      throw error;
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
