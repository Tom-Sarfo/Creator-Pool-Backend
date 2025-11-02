import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import {
  VideoService,
  CreateVideoDto,
  UpdateVideoDto,
  ImportYouTubeVideoDto,
} from "./video.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User, UserRole } from "../entities/user.entity";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";

@Controller("videos")
export class VideoController {
  constructor(private videoService: VideoService) {}

  @Post()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createVideo(
    @CurrentUser() user: User,
    @Body() createVideoDto: CreateVideoDto
  ) {
    return this.videoService.createVideo(user.id, createVideoDto);
  }

  @Get()
  async getVideos(
    @Query("creatorId") creatorId?: string,
    @Query("status") status?: string,
    @Query("visibility") visibility?: string,
    @Query("hasActivePool") hasActivePool?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    const filters = {
      creatorId,
      status,
      visibility,
      hasActivePool: hasActivePool === "true",
    };

    return this.videoService.getVideos(
      filters,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10
    );
  }

  @Get("creator/:creatorId")
  async getCreatorVideos(@Param("creatorId") creatorId: string) {
    return this.videoService.getVideos({ creatorId });
  }

  @Get(":id")
  async getVideoById(@Param("id") id: string) {
    return this.videoService.getVideoById(id);
  }

  @Get("youtube/:youtubeId")
  async getVideoByYouTubeId(@Param("youtubeId") youtubeId: string) {
    return this.videoService.getVideoByYouTubeId(youtubeId);
  }

  @Put(":id")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateVideo(
    @Param("id") id: string,
    @Body() updateVideoDto: UpdateVideoDto
  ) {
    return this.videoService.updateVideo(id, updateVideoDto);
  }

  @Delete(":id")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteVideo(@Param("id") id: string) {
    await this.videoService.deleteVideo(id);
  }

  @Post("import-youtube")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async importYouTubeVideo(
    @CurrentUser() user: User,
    @Body() importDto: ImportYouTubeVideoDto
  ) {
    return this.videoService.importYouTubeVideo(user.id, importDto);
  }

  @Post(":id/sync-metrics")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async syncVideoMetrics(@Param("id") id: string) {
    return this.videoService.syncVideoMetrics(id);
  }

  @Post(":id/transition-to-public")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async transitionVideoToPublic(@Param("id") id: string) {
    return this.videoService.transitionVideoToPublic(id);
  }

  @Get(":id/metrics")
  @Throttle({ short: { limit: 30, ttl: 60000 } }) // 30 requests per minute
  async getVideoMetrics(@Param("id") id: string) {
    return this.videoService.getVideoMetrics(id);
  }
}
