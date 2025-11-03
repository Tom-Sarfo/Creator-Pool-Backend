import { Injectable, Logger, Inject } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Video } from "../../entities/video.entity";
import { Pool, PoolStatus } from "../../entities/pool.entity";
import { User } from "../../entities/user.entity";
import { YouTubeService } from "../../youtube/youtube.service";

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
    private youtubeService: YouTubeService
  ) {}

  /**
   * Update metrics for all videos that are being tracked
   * This should be called every 5-10 minutes
   */
  async updateVideoMetrics(): Promise<void> {
    this.logger.log("Updating video metrics...");

    try {
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

      this.logger.log(`Updated metrics for ${trackingPools.length} videos`);
    } catch (error) {
      this.logger.error("Error updating video metrics:", error);
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
      this.logger.error(
        `Error fetching YouTube metrics for video ${video.youtubeId}:`,
        error
      );
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
