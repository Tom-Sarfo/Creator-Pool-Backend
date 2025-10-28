import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Video } from "../../entities/video.entity";
import { Pool, PoolStatus } from "../../entities/pool.entity";

@Injectable()
export class MetricsTrackingService {
  private readonly logger = new Logger(MetricsTrackingService.name);

  constructor(
    @InjectRepository(Video)
    private videoRepository: Repository<Video>,
    @InjectRepository(Pool)
    private poolRepository: Repository<Pool>
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
      // In production, this would call the YouTube Data API
      const metrics = await this.fetchYouTubeMetrics(video.youtubeId);

      if (metrics) {
        video.viewCount = metrics.viewCount;
        video.likeCount = metrics.likeCount;
        video.commentCount = metrics.commentCount;
        video.lastSyncedAt = new Date();

        await this.videoRepository.save(video);

        // Update pool with current metrics
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
   * Simulate YouTube API call to fetch video metrics
   * In production, this would call the actual YouTube Data API
   */
  private async fetchYouTubeMetrics(youtubeId: string): Promise<{
    viewCount: number;
    likeCount: number;
    commentCount: number;
  } | null> {
    // TODO: Implement actual YouTube API call
    // For now, return null to prevent API calls in development
    this.logger.debug(`Fetching YouTube metrics for video: ${youtubeId}`);

    // Simulate some metrics for testing
    return {
      viewCount: Math.floor(Math.random() * 10000) + 1000,
      likeCount: Math.floor(Math.random() * 500) + 50,
      commentCount: Math.floor(Math.random() * 100) + 10,
    };
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

      // Update odds based on current metrics vs target
      await this.updatePoolOdds(pool);

      await this.poolRepository.save(pool);
    }
  }

  /**
   * Update pool odds based on current performance
   */
  private async updatePoolOdds(pool: Pool): Promise<void> {
    // Simple odds calculation based on current views vs target
    const progressRatio = Number(pool.currentViews) / Number(pool.targetViews);

    // Adjust odds based on progress (simplified logic)
    if (progressRatio >= 0.8) {
      // Video is performing well, favor YES
      pool.yesOdds = 0.3;
      pool.noOdds = 0.7;
    } else if (progressRatio >= 0.5) {
      // Video is performing moderately
      pool.yesOdds = 0.5;
      pool.noOdds = 0.5;
    } else {
      // Video is underperforming, favor NO
      pool.yesOdds = 0.7;
      pool.noOdds = 0.3;
    }
  }

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
