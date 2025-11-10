import { Injectable, Logger, Inject } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Video } from "../../entities/video.entity";
import { Pool, PoolStatus } from "../../entities/pool.entity";
import { User } from "../../entities/user.entity";
import { YouTubeService } from "../../youtube/youtube.service";
import { VideoStatusTransitionService } from "./video-status-transition.service";

@Injectable()
export class MetricsTrackingService {
  private readonly logger = new Logger(MetricsTrackingService.name);

  constructor(
    @InjectRepository(Video)
    private videoRepository: Repository<Video>,
    @InjectRepository(Pool)
    private poolRepository: Repository<Pool>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(YouTubeService)
    private youtubeService: YouTubeService,
    @Inject(VideoStatusTransitionService)
    private videoStatusTransitionService: VideoStatusTransitionService
  ) {}

  /**
   * Update metrics for all videos that are being tracked
   * This should be called every 2 minutes
   * Now tracks ALL public videos for milestone collection (broader data collection)
   * Also checks for status transitions from unlisted to public
   */
  async updateVideoMetrics(): Promise<void> {
    this.logger.log("Updating video metrics...");

    try {
      // First, check for status transitions (unlisted -> public)
      // This ensures videos are transitioned before metrics are updated
      await this.videoStatusTransitionService.checkVideoStatusTransitions();

      // Get all videos that are being tracked (have active pools in live_tracking status)
      const trackingPools = await this.poolRepository.find({
        where: { status: PoolStatus.LIVE_TRACKING },
        relations: ["video"],
      });

      for (const pool of trackingPools) {
        if (pool.video) {
          await this.updateVideoMetricsForPool(pool.video);
        }
      }

      // Also track milestones for ALL public videos (broader data collection)
      await this.updateAllPublicVideoMilestones();

      this.logger.log(
        `Updated metrics for ${trackingPools.length} videos with active pools`
      );
    } catch (error) {
      this.logger.error("Error updating video metrics:", error);
    }
  }

  /**
   * Update milestones for all public videos older than 24 hours
   * This ensures we capture milestone data for all videos, not just those with active pools
   */
  private async updateAllPublicVideoMilestones(): Promise<void> {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const publicVideos = await this.videoRepository
        .createQueryBuilder("video")
        .where("video.status = :status", { status: "public" })
        .andWhere("video.visibility = :visibility", { visibility: "public" })
        .andWhere("video.publishedAt IS NOT NULL")
        .andWhere("video.publishedAt < :cutoff", { cutoff: twentyFourHoursAgo })
        .getMany();

      for (const video of publicVideos) {
        // Only update if video needs milestone capture
        if (
          !video.milestone24hCapturedAt ||
          !video.milestone48hCapturedAt ||
          !video.milestone7dCapturedAt ||
          !video.milestone30dCapturedAt
        ) {
          const metrics = await this.fetchYouTubeMetrics(video);
          if (metrics) {
            await this.captureMilestones(video, metrics.viewCount);
            // Always update metrics to reflect current YouTube data
            video.viewCount = metrics.viewCount;
            video.likeCount = metrics.likeCount;
            video.commentCount = metrics.commentCount;
            await this.videoRepository.save(video);
          }
        }
      }

      if (publicVideos.length > 0) {
        this.logger.debug(
          `Updated milestones for ${publicVideos.length} public videos`
        );
      }
    } catch (error) {
      this.logger.error("Error updating public video milestones:", error);
    }
  }

  /**
   * Update metrics for a specific video
   */
  async updateVideoMetricsForPool(video: Video): Promise<void> {
    try {
      const metrics = await this.fetchYouTubeMetrics(video);

      if (metrics) {
        video.viewCount = metrics.viewCount;
        video.likeCount = metrics.likeCount;
        video.commentCount = metrics.commentCount;
        video.lastSyncedAt = new Date();

        // Capture milestones if video has been published
        if (video.publishedAt) {
          await this.captureMilestones(video, metrics.viewCount);
        }

        await this.videoRepository.save(video);

        await this.updatePoolMetrics(video);

        this.logger.debug(`Updated metrics for video ${video.youtubeId}:`, {
          views: metrics.viewCount,
          likes: metrics.likeCount,
          comments: metrics.commentCount,
        });
      }
    } catch (error) {
      this.logger.error(
        `Error updating metrics for video ${video.youtubeId}:`,
        error
      );
    }
  }

  /**
   * Capture milestone view counts for a video
   * Only captures each milestone once
   */
  private async captureMilestones(
    video: Video,
    currentViewCount: number
  ): Promise<void> {
    if (!video.publishedAt) {
      return;
    }

    const hoursSincePublication = video.getHoursSincePublication();

    // Capture 24h milestone (24 hours = 1 day)
    if (hoursSincePublication >= 24 && !video.milestone24hCapturedAt) {
      // If video is older than 24h but milestone wasn't captured, use current viewCount as fallback
      video.views24h = currentViewCount;
      video.milestone24hCapturedAt = new Date();
    }

    // Capture 48h milestone
    if (hoursSincePublication >= 48 && !video.milestone48hCapturedAt) {
      video.views48h = currentViewCount;
      video.milestone48hCapturedAt = new Date();
    }

    // Capture 7d milestone (7 days = 168 hours)
    if (hoursSincePublication >= 168 && !video.milestone7dCapturedAt) {
      video.views7d = currentViewCount;
      video.milestone7dCapturedAt = new Date();
    }

    // Capture 30d milestone (30 days = 720 hours)
    if (hoursSincePublication >= 720 && !video.milestone30dCapturedAt) {
      video.views30d = currentViewCount;
      video.milestone30dCapturedAt = new Date();
    }
  }

  /**
   * Fetch video metrics from YouTube API
   */
  private async fetchYouTubeMetrics(video: Video): Promise<{
    viewCount: number;
    likeCount: number;
    commentCount: number;
  } | null> {
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
      this.logger.warn(
        `Cannot fetch metrics for video ${video.youtubeId}: creator ${video.creatorId} not connected to YouTube`
      );
      return null;
    }

    try {
      const accessToken = await this.youtubeService.refreshTokenIfNeeded(user);
      const metrics = await this.youtubeService.getVideoMetrics(
        accessToken,
        video.youtubeId
      );

      return metrics;
    } catch (error) {
      // Check if error is due to invalid/revoked tokens
      if (
        error instanceof Error &&
        error.message.includes("reconnect your YouTube account")
      ) {
        this.logger.warn(
          `Cannot fetch metrics for video ${video.youtubeId}: Creator ${video.creatorId} needs to reconnect YouTube account. Tokens have been cleared.`
        );
      } else {
        this.logger.error(
          `Error fetching YouTube metrics for video ${video.youtubeId}:`,
          error
        );
      }
      return null;
    }
  }

  /**
   * Update pool metrics based on current video metrics
   */
  private async updatePoolMetrics(video: Video): Promise<void> {
    const pools = await this.poolRepository.find({
      where: {
        videoId: video.id,
        status: PoolStatus.LIVE_TRACKING,
      },
    });

    for (const pool of pools) {
      pool.currentViews = video.viewCount;

      // Note: Probabilities are calculated based on weighted stakes, not video metrics
      // Probabilities will be updated when predictions are added/removed

      await this.poolRepository.save(pool);
    }
  }

  // Note: Odds-based calculations removed
  // Probabilities are now calculated based on weighted stakes using sqrt(stake) formula
  // This happens automatically in ProbabilityService when predictions are added/removed

  /**
   * Get current metrics for a video
   */
  async getVideoMetrics(videoId: string): Promise<{
    viewCount: number;
    likeCount: number;
    commentCount: number;
    lastSyncedAt: Date;
  } | null> {
    const video = await this.videoRepository.findOne({
      where: { id: videoId },
    });

    if (!video) {
      return null;
    }

    return {
      viewCount: video.viewCount,
      likeCount: video.likeCount,
      commentCount: video.commentCount,
      lastSyncedAt: video.lastSyncedAt,
    };
  }

  /**
   * Get metrics for all videos being tracked
   */
  async getAllTrackingMetrics(): Promise<
    Array<{
      videoId: string;
      youtubeId: string;
      title: string;
      viewCount: number;
      likeCount: number;
      commentCount: number;
      lastSyncedAt: Date;
      poolCount: number;
    }>
  > {
    const trackingPools = await this.poolRepository.find({
      where: { status: PoolStatus.LIVE_TRACKING },
      relations: ["video"],
    });

    const videoMetricsMap = new Map();

    for (const pool of trackingPools) {
      if (pool.video) {
        const videoId = pool.video.id;

        if (!videoMetricsMap.has(videoId)) {
          videoMetricsMap.set(videoId, {
            videoId: pool.video.id,
            youtubeId: pool.video.youtubeId,
            title: pool.video.title,
            viewCount: pool.video.viewCount,
            likeCount: pool.video.likeCount,
            commentCount: pool.video.commentCount,
            lastSyncedAt: pool.video.lastSyncedAt,
            poolCount: 0,
          });
        }

        videoMetricsMap.get(videoId).poolCount++;
      }
    }

    return Array.from(videoMetricsMap.values());
  }

  /**
   * Manually trigger metrics update for a specific video
   */
  async triggerMetricsUpdate(videoId: string): Promise<void> {
    const video = await this.videoRepository.findOne({
      where: { id: videoId },
    });

    if (!video) {
      throw new Error(`Video with ID ${videoId} not found`);
    }

    await this.updateVideoMetricsForPool(video);
  }

  /**
   * Get metrics history for a video (if implemented)
   */
  async getVideoMetricsHistory(
    videoId: string,
    hours: number = 24
  ): Promise<any[]> {
    // TODO: Implement metrics history tracking
    // This would require a separate VideoMetricsHistory entity
    this.logger.debug(
      `Getting metrics history for video ${videoId} for last ${hours} hours`
    );
    return [];
  }
}
