import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  UseGuards,
  Res,
  Inject,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Response } from "express";
import { YouTubeService } from "./youtube.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User, UserRole } from "../entities/user.entity";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";

@Controller("youtube")
export class YouTubeController {
  private readonly logger = new Logger(YouTubeController.name);

  constructor(@Inject(YouTubeService) private youtubeService: YouTubeService) {}

  @Get("auth-url")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  async getAuthUrl(@CurrentUser() user: User) {
    try {
      if (!user || !user.id) {
        throw new HttpException(
          {
            success: false,
            error: "User not authenticated",
            details: "User object is missing or invalid",
          },
          HttpStatus.UNAUTHORIZED
        );
      }

      const authUrl = this.youtubeService.generateAuthUrl(user.id);
      return { authUrl, success: true };
    } catch (error) {
      this.logger.error("Error generating YouTube auth URL:", error);

      throw new HttpException(
        {
          success: false,
          error: error.message || "Failed to generate authorization URL",
          details: error.message || "Unknown error occurred",
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get("callback")
  async handleCallback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("error") error: string,
    @Res() res: Response
  ) {
    this.logger.log("YouTube OAuth Callback received");

    // Check if OAuth flow was cancelled or had an error
    if (error) {
      this.logger.error(`YouTube OAuth error: ${error}`);
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5179";
      return res.redirect(
        `${frontendUrl}/creator/dashboard?youtube=error&reason=${error}`
      );
    }

    // Validate required parameters
    if (!code || !state) {
      this.logger.error(
        `Missing required parameters - code: ${!!code}, state: ${!!state}`
      );
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5179";
      return res.redirect(
        `${frontendUrl}/creator/dashboard?youtube=error&reason=missing_parameters`
      );
    }

    try {
      this.logger.log("Processing OAuth callback...");
      const result = await this.youtubeService.handleOAuthCallback(code, state);

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5179";

      if (result.success) {
        this.logger.log(`YouTube connection successful: ${result.message}`);
        // Redirect to frontend success page
        return res.redirect(
          `${frontendUrl}/creator/dashboard?youtube=connected&message=${encodeURIComponent(result.message)}`
        );
      } else {
        // Redirect to frontend error page
        return res.redirect(
          `${frontendUrl}/creator/dashboard?youtube=error&reason=${encodeURIComponent(result.message)}`
        );
      }
    } catch (error) {
      this.logger.error("Callback handler error:", error);
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5179";
      const errorMessage =
        error instanceof Error ? error.message : "callback_failed";
      return res.redirect(
        `${frontendUrl}/creator/dashboard?youtube=error&reason=${encodeURIComponent(errorMessage)}`
      );
    }
  }

  @Post("sync")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  async syncChannel(@CurrentUser() user: User) {
    return this.youtubeService.syncChannelVideos(user.id);
  }

  @Get("unlisted")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  async getUnlistedVideos(@CurrentUser() user: User) {
    return this.youtubeService.getUnlistedVideos(user.id);
  }

  @Get("status")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  async getConnectionStatus(@CurrentUser() user: User) {
    const connected = await this.youtubeService.isYouTubeConnected(user.id);
    return {
      connected,
      channelId: user.youtubeChannelId,
      lastSyncAt: user.updatedAt,
    };
  }

  @Get("videos")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  async getAllVideos(@CurrentUser() user: User) {
    try {
      const videos = await this.youtubeService.getAllVideos(user.id);
      this.logger.log(`Returning ${videos.length} videos for user ${user.id}`);
      return {
        success: true,
        count: videos.length,
        videos,
      };
    } catch (error) {
      this.logger.error("Error fetching videos:", error);
      throw new HttpException(
        {
          success: false,
          error: error.message || "Failed to fetch videos",
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete("disconnect")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  async disconnectYouTube(@CurrentUser() user: User) {
    await this.youtubeService.disconnectYouTube(user.id);
    return {
      success: true,
      message: "YouTube channel disconnected successfully",
    };
  }

  @Get("test")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  async testConnection(@CurrentUser() user: User) {
    this.logger.log(`🧪 Testing YouTube connection for user ${user.id}`);

    try {
      const testResult = await this.youtubeService.testYouTubeConnection(
        user.id
      );

      return {
        success: testResult.success,
        message: testResult.message,
        details: testResult.details,
        tests: testResult.tests,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error("Connection test failed:", error);
      throw new HttpException(
        {
          success: false,
          error: error.message || "Connection test failed",
          details: "An error occurred while testing the connection",
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
