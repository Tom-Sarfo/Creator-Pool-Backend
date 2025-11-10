import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Not, IsNull } from "typeorm";
import {
  Video,
  VideoStatus,
  VideoVisibility,
} from "../../entities/video.entity";

export interface AverageViews {
  avg24hViews: number | null;
  avg48hViews: number | null;
  avg7dViews: number | null;
  avg30dViews: number | null;
  sampleSize: number;
}

export interface CreatorVideoStats {
  totalVideos: number;
  videosWithMilestones: number;
}

@Injectable()
export class CreatorAnalyticsService {
  private readonly logger = new Logger(CreatorAnalyticsService.name);

  constructor(
    @InjectRepository(Video)
    private videoRepository: Repository<Video>
  ) {}

  /**
   * Calculate average views from creator's last 10-20 public videos
   */
  async calculateAverageViews(creatorId: string): Promise<AverageViews> {
    const videos = await this.getRecentPublicVideos(creatorId, 20);

    // Filter videos that have milestone data captured
    const videosWith24h = videos.filter(
      (v) => v.views24h !== null && v.views24h !== undefined
    );
    const videosWith48h = videos.filter(
      (v) => v.views48h !== null && v.views48h !== undefined
    );
    const videosWith7d = videos.filter(
      (v) => v.views7d !== null && v.views7d !== undefined
    );
    const videosWith30d = videos.filter(
      (v) => v.views30d !== null && v.views30d !== undefined
    );

    // Calculate averages from videos with actual milestone data
    const avg24hViews =
      videosWith24h.length > 0
        ? videosWith24h.reduce((sum, v) => sum + (v.views24h || 0), 0) /
          videosWith24h.length
        : null;

    const avg48hViews =
      videosWith48h.length > 0
        ? videosWith48h.reduce((sum, v) => sum + (v.views48h || 0), 0) /
          videosWith48h.length
        : null;

    const avg7dViews =
      videosWith7d.length > 0
        ? videosWith7d.reduce((sum, v) => sum + (v.views7d || 0), 0) /
          videosWith7d.length
        : null;

    const avg30dViews =
      videosWith30d.length > 0
        ? videosWith30d.reduce((sum, v) => sum + (v.views30d || 0), 0) /
          videosWith30d.length
        : null;

    // Use the largest sample size for overall sample size
    const sampleSize = Math.max(
      videosWith24h.length,
      videosWith48h.length,
      videosWith7d.length,
      videosWith30d.length
    );

    return {
      avg24hViews: avg24hViews ? Math.round(avg24hViews) : null,
      avg48hViews: avg48hViews ? Math.round(avg48hViews) : null,
      avg7dViews: avg7dViews ? Math.round(avg7dViews) : null,
      avg30dViews: avg30dViews ? Math.round(avg30dViews) : null,
      sampleSize,
    };
  }

  /**
   * Get total number of public videos for a creator
   */
  async getCreatorVideoCount(creatorId: string): Promise<number> {
    return this.videoRepository.count({
      where: {
        creatorId,
        status: VideoStatus.PUBLIC,
        visibility: VideoVisibility.PUBLIC,
      },
    });
  }

  /**
   * Get recent public videos for comparison (for creators with <10 videos)
   */
  async getRecentVideos(
    creatorId: string,
    limit: number = 3
  ): Promise<Video[]> {
    return this.videoRepository.find({
      where: {
        creatorId,
        status: VideoStatus.PUBLIC,
        visibility: VideoVisibility.PUBLIC,
        publishedAt: Not(IsNull()),
      },
      order: { publishedAt: "DESC" },
      take: limit,
    });
  }

  /**
   * Get last N public videos ordered by publication date
   */
  private async getRecentPublicVideos(
    creatorId: string,
    limit: number = 20
  ): Promise<Video[]> {
    return this.videoRepository.find({
      where: {
        creatorId,
        status: VideoStatus.PUBLIC,
        visibility: VideoVisibility.PUBLIC,
        publishedAt: Not(IsNull()),
      },
      order: { publishedAt: "DESC" },
      take: limit,
    });
  }

  /**
   * Get creator video statistics
   */
  async getCreatorVideoStats(creatorId: string): Promise<CreatorVideoStats> {
    const totalVideos = await this.getCreatorVideoCount(creatorId);

    // Count videos with at least one milestone captured
    const videosWithMilestones = await this.videoRepository
      .createQueryBuilder("video")
      .where("video.creatorId = :creatorId", { creatorId })
      .andWhere("video.status = :status", { status: VideoStatus.PUBLIC })
      .andWhere("video.visibility = :visibility", {
        visibility: VideoVisibility.PUBLIC,
      })
      .andWhere(
        "(video.milestone24hCapturedAt IS NOT NULL OR video.milestone48hCapturedAt IS NOT NULL OR video.milestone7dCapturedAt IS NOT NULL OR video.milestone30dCapturedAt IS NOT NULL)"
      )
      .getCount();

    return {
      totalVideos,
      videosWithMilestones,
    };
  }
}
