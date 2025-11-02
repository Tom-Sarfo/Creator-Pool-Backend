import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Video, VideoStatus, VideoVisibility } from "../entities/video.entity";
import { User } from "../entities/user.entity";
import { VideoStatusTransitionService } from "./services/video-status-transition.service";
import { MetricsTrackingService } from "./services/metrics-tracking.service";

export interface CreateVideoDto {
  youtubeId: string;
  title: string;
  description?: string;
  thumbnail: string;
  duration: string;
  visibility: VideoVisibility;
}

export interface UpdateVideoDto {
  title?: string;
  description?: string;
  thumbnail?: string;
}

export interface ImportYouTubeVideoDto {
  youtubeUrl: string;
}

@Injectable()
export class VideoService {
  constructor(
    @InjectRepository(Video)
    private videoRepository: Repository<Video>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private videoStatusTransitionService: VideoStatusTransitionService,
    private metricsTrackingService: MetricsTrackingService
  ) {}

  /**
   * Create a new video
   */
  async createVideo(
    creatorId: string,
    createVideoDto: CreateVideoDto
  ): Promise<Video> {
    // Check if creator exists
    const creator = await this.userRepository.findOne({
      where: { id: creatorId },
    });
    if (!creator) {
      throw new NotFoundException("Creator not found");
    }

    // Check if video already exists
    const existingVideo = await this.videoRepository.findOne({
      where: { youtubeId: createVideoDto.youtubeId },
    });
    if (existingVideo) {
      throw new ConflictException("Video with this YouTube ID already exists");
    }

    // Create video
    const video = this.videoRepository.create({
      ...createVideoDto,
      creatorId,
      status: VideoStatus.UNLISTED,
      visibility: createVideoDto.visibility,
    });

    return this.videoRepository.save(video);
  }

  /**
   * Get all videos with optional filters
   */
  async getVideos(
    filters: {
      creatorId?: string;
      status?: VideoStatus;
      visibility?: VideoVisibility;
      hasActivePool?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ videos: Video[]; total: number; page: number; limit: number }> {
    const {
      creatorId,
      status,
      visibility,
      hasActivePool,
      page = 1,
      limit = 10,
    } = filters;
    const skip = (page - 1) * limit;

    const queryBuilder = this.videoRepository
      .createQueryBuilder("video")
      .leftJoinAndSelect("video.creator", "creator")
      .leftJoinAndSelect("video.pools", "pools");

    if (creatorId) {
      queryBuilder.where("video.creatorId = :creatorId", { creatorId });
    }

    if (status) {
      queryBuilder.andWhere("video.status = :status", { status });
    }

    if (visibility) {
      queryBuilder.andWhere("video.visibility = :visibility", { visibility });
    }

    if (hasActivePool !== undefined) {
      queryBuilder.andWhere("video.hasActivePool = :hasActivePool", {
        hasActivePool,
      });
    }

    const [videos, total] = await queryBuilder
      .orderBy("video.createdAt", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      videos,
      total,
      page,
      limit,
    };
  }

  /**
   * Get a single video by ID
   */
  async getVideoById(id: string): Promise<Video> {
    const video = await this.videoRepository.findOne({
      where: { id },
      relations: ["creator", "pools"],
    });

    if (!video) {
      throw new NotFoundException("Video not found");
    }

    return video;
  }

  /**
   * Get video by YouTube ID
   */
  async getVideoByYouTubeId(youtubeId: string): Promise<Video> {
    const video = await this.videoRepository.findOne({
      where: { youtubeId },
      relations: ["creator", "pools"],
    });

    if (!video) {
      throw new NotFoundException("Video not found");
    }

    return video;
  }

  /**
   * Update a video
   */
  async updateVideo(
    id: string,
    updateVideoDto: UpdateVideoDto
  ): Promise<Video> {
    const video = await this.getVideoById(id);

    Object.assign(video, updateVideoDto);
    video.lastSyncedAt = new Date();

    return this.videoRepository.save(video);
  }

  /**
   * Delete a video
   */
  async deleteVideo(id: string): Promise<void> {
    const video = await this.getVideoById(id);

    // Check if video has active pools
    if (video.hasActivePool) {
      throw new BadRequestException("Cannot delete video with active pools");
    }

    await this.videoRepository.remove(video);
  }

  /**
   * Import video from YouTube URL
   */
  async importYouTubeVideo(
    creatorId: string,
    importDto: ImportYouTubeVideoDto
  ): Promise<Video> {
    // Extract YouTube ID from URL
    const youtubeId = this.extractYouTubeId(importDto.youtubeUrl);
    if (!youtubeId) {
      throw new BadRequestException("Invalid YouTube URL");
    }

    // Check if video already exists
    const existingVideo = await this.videoRepository.findOne({
      where: { youtubeId },
    });
    if (existingVideo) {
      throw new ConflictException("Video already exists");
    }

    // TODO: Fetch video details from YouTube API
    // For now, create with placeholder data
    const videoData: CreateVideoDto = {
      youtubeId,
      title: `Imported Video ${youtubeId}`,
      description: "Imported from YouTube",
      thumbnail: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
      duration: "0:00",
      visibility: VideoVisibility.UNLISTED,
    };

    return this.createVideo(creatorId, videoData);
  }

  /**
   * Sync video metrics from YouTube
   */
  async syncVideoMetrics(id: string): Promise<Video> {
    const video = await this.getVideoById(id);

    // Trigger metrics update
    await this.metricsTrackingService.updateVideoMetricsForPool(video);

    // Return updated video
    return this.getVideoById(id);
  }

  /**
   * Manually transition video to public (for testing)
   */
  async transitionVideoToPublic(id: string): Promise<Video> {
    await this.videoStatusTransitionService.manuallyTransitionVideoToPublic(id);
    return this.getVideoById(id);
  }

  /**
   * Get videos ready for pool creation
   */
  async getVideosForPoolCreation(creatorId: string): Promise<Video[]> {
    return this.videoRepository.find({
      where: {
        creatorId,
        status: VideoStatus.UNLISTED,
        visibility: VideoVisibility.UNLISTED,
        hasActivePool: false,
      },
      relations: ["creator"],
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Get videos being tracked
   */
  async getTrackingVideos(): Promise<Video[]> {
    return this.videoRepository.find({
      where: {
        status: VideoStatus.PUBLIC,
        hasActivePool: true,
      },
      relations: ["creator", "pools"],
      order: { publishedAt: "DESC" },
    });
  }

  /**
   * Update video pool status
   */
  async updateVideoPoolStatus(
    id: string,
    hasActivePool: boolean
  ): Promise<Video> {
    const video = await this.getVideoById(id);
    video.hasActivePool = hasActivePool;

    if (hasActivePool) {
      video.poolCreatedAt = new Date();
    } else {
      video.poolClosedAt = new Date();
    }

    return this.videoRepository.save(video);
  }

  /**
   * Extract YouTube ID from URL
   */
  private extractYouTubeId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Get video metrics
   */
  async getVideoMetrics(id: string): Promise<{
    viewCount: number;
    likeCount: number;
    commentCount: number;
    lastSyncedAt: Date;
  } | null> {
    return this.metricsTrackingService.getVideoMetrics(id);
  }

  /**
   * Get all tracking metrics
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
    return this.metricsTrackingService.getAllTrackingMetrics();
  }
}
