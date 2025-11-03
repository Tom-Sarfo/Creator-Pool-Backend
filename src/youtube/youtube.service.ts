import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../entities/user.entity";
import { Video, VideoStatus, VideoVisibility } from "../entities/video.entity";

export interface YouTubeVideoData {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  publishedAt: string;
  status: "public" | "unlisted" | "private";
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

export interface YouTubeChannelData {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  subscriberCount: number;
  videoCount: number;
}

@Injectable()
export class YouTubeService {
  private readonly logger = new Logger(YouTubeService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Video)
    private videoRepository: Repository<Video>
  ) {}

  generateAuthUrl(userId: string): string {
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const backendUrl =
      process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
    const redirectUri =
      process.env.YOUTUBE_REDIRECT_URI || `${backendUrl}/api/youtube/callback`;

    if (!clientId) {
      throw new BadRequestException(
        "YouTube client ID not configured. Please set YOUTUBE_CLIENT_ID environment variable."
      );
    }

    if (!redirectUri) {
      throw new BadRequestException(
        "YouTube redirect URI not configured. Please set YOUTUBE_REDIRECT_URI environment variable."
      );
    }

    // Encode user ID in state parameter to retrieve it after OAuth callback
    const state = Buffer.from(JSON.stringify({ userId })).toString("base64");

    this.logger.log(`Generating YouTube OAuth URL for user ${userId}`);
    this.logger.log(`Redirect URI: ${redirectUri}`);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/youtube.readonly",
      access_type: "offline",
      prompt: "consent",
      state: state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleOAuthCallback(
    code: string,
    state: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (!code) {
        throw new BadRequestException("Authorization code is missing");
      }

      if (!state) {
        throw new BadRequestException("State parameter is missing");
      }

      let decodedState: { userId: string };
      try {
        decodedState = JSON.parse(Buffer.from(state, "base64").toString());
      } catch (parseError) {
        this.logger.error(`Failed to decode state parameter: ${state}`);
        throw new BadRequestException("Invalid state parameter");
      }

      if (!decodedState.userId) {
        throw new BadRequestException("User ID not found in state parameter");
      }

      const userId = decodedState.userId;
      const tokens = await this.exchangeCodeForTokens(code);
      const channelData = await this.getChannelInfo(tokens.access_token);

      await this.updateUserYouTubeCredentials(userId, {
        youtubeChannelId: channelData.id,
        youtubeAccessToken: tokens.access_token,
        youtubeRefreshToken: tokens.refresh_token,
        youtubeTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      });

      this.logger.log(
        `YouTube channel connected for user ${userId}: ${channelData.title}`
      );

      try {
        const syncResult = await this.syncChannelVideos(userId);
        this.logger.log(
          `Videos synced: ${syncResult.newVideosCount} new, ${syncResult.updatedVideosCount} updated, ${syncResult.videosCount} total`
        );
      } catch (syncError) {
        this.logger.error("Failed to sync videos after connection:", syncError);
      }

      return {
        success: true,
        message: `Successfully connected to channel: ${channelData.title}`,
      };
    } catch (error) {
      this.logger.error("OAuth callback error:", error);
      return {
        success: false,
        message: "Failed to connect YouTube channel",
      };
    }
  }

  async syncChannelVideos(userId: string): Promise<{
    success: boolean;
    videosCount: number;
    newVideosCount: number;
    updatedVideosCount: number;
    unlistedVideosCount: number;
  }> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: [
          "id",
          "youtubeChannelId",
          "youtubeAccessToken",
          "youtubeRefreshToken",
          "youtubeTokenExpiresAt",
        ],
      });

      if (!user || !user.youtubeAccessToken) {
        this.logger.error(
          `User ${userId} not connected to YouTube - user: ${!!user}, token: ${!!user?.youtubeAccessToken}`
        );
        throw new BadRequestException("User not connected to YouTube");
      }

      const accessToken = await this.refreshTokenIfNeeded(user);
      const channelVideos = await this.getChannelVideos(
        accessToken,
        user.youtubeChannelId
      );

      let newVideosCount = 0;
      let updatedVideosCount = 0;
      let unlistedVideosCount = 0;

      for (const videoData of channelVideos) {
        const existingVideo = await this.videoRepository.findOne({
          where: { youtubeId: videoData.id },
        });

        if (existingVideo) {
          await this.updateVideoFromYouTubeData(existingVideo, videoData);
          updatedVideosCount++;
        } else {
          await this.createVideoFromYouTubeData(userId, videoData);
          newVideosCount++;
        }

        if (videoData.status === "unlisted") {
          unlistedVideosCount++;
        }
      }

      this.logger.log(
        `Synced ${channelVideos.length} videos for user ${userId} - ${newVideosCount} new, ${updatedVideosCount} updated`
      );

      return {
        success: true,
        videosCount: channelVideos.length,
        newVideosCount,
        updatedVideosCount,
        unlistedVideosCount,
      };
    } catch (error) {
      this.logger.error(
        `Error syncing channel videos for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  async getUnlistedVideos(userId: string): Promise<Video[]> {
    return this.videoRepository.find({
      where: {
        creatorId: userId,
        status: VideoStatus.UNLISTED,
        visibility: VideoVisibility.UNLISTED,
        hasActivePool: false,
      },
      order: { createdAt: "DESC" },
    });
  }

  async getAllVideos(userId: string): Promise<Video[]> {
    const videos = await this.videoRepository.find({
      where: {
        creatorId: userId,
      },
      order: { createdAt: "DESC" },
    });

    return videos;
  }

  async getChannelInfo(accessToken: string): Promise<YouTubeChannelData> {
    try {
      const myChannelResponse = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!myChannelResponse.ok) {
        const errorData = await myChannelResponse.text();
        this.logger.error(`Failed to fetch channel info: ${errorData}`);
        throw new BadRequestException(
          "Failed to fetch YouTube channel information"
        );
      }

      const myChannelData = await myChannelResponse.json();

      if (!myChannelData.items || myChannelData.items.length === 0) {
        throw new BadRequestException("No YouTube channel found for this user");
      }

      const channel = myChannelData.items[0];
      const snippet = channel.snippet || {};
      const statistics = channel.statistics || {};

      this.logger.log(`Fetched channel info: ${snippet.title} (${channel.id})`);

      return {
        id: channel.id,
        title: snippet.title || "Untitled Channel",
        description: snippet.description || "",
        thumbnail:
          snippet.thumbnails?.high?.url ||
          snippet.thumbnails?.default?.url ||
          "",
        subscriberCount: parseInt(statistics.subscriberCount || "0", 10),
        videoCount: parseInt(statistics.videoCount || "0", 10),
      };
    } catch (error) {
      this.logger.error("Error getting channel info:", error);
      throw error;
    }
  }

  async getVideoMetrics(
    accessToken: string,
    youtubeId: string
  ): Promise<{
    viewCount: number;
    likeCount: number;
    commentCount: number;
  } | null> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${youtubeId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        this.logger.error(
          `Failed to fetch video metrics for ${youtubeId}: ${errorData}`
        );
        return null;
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        this.logger.warn(`Video ${youtubeId} not found`);
        return null;
      }

      const statistics = data.items[0].statistics || {};

      return {
        viewCount: parseInt(statistics.viewCount || "0", 10),
        likeCount: parseInt(statistics.likeCount || "0", 10),
        commentCount: parseInt(statistics.commentCount || "0", 10),
      };
    } catch (error) {
      this.logger.error(
        `Error fetching video metrics for ${youtubeId}:`,
        error
      );
      return null;
    }
  }

  private async getChannelVideos(
    accessToken: string,
    channelId: string
  ): Promise<YouTubeVideoData[]> {
    const videos: YouTubeVideoData[] = [];

    try {
      // Fetch uploads playlist ID - contains ALL videos (public, unlisted, private)
      const channelResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!channelResponse.ok) {
        const errorData = await channelResponse.text();
        this.logger.error(`Failed to fetch channel details: ${errorData}`);
        throw new BadRequestException("Failed to fetch channel details");
      }

      const channelData = await channelResponse.json();

      if (!channelData.items || channelData.items.length === 0) {
        throw new BadRequestException("Channel not found");
      }

      const uploadsPlaylistId =
        channelData.items[0].contentDetails?.relatedPlaylists?.uploads;

      if (!uploadsPlaylistId) {
        throw new BadRequestException(
          "Uploads playlist not found for this channel"
        );
      }

      // Paginate through all videos in the uploads playlist
      let nextPageToken: string | undefined = undefined;

      do {
        let playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50`;
        if (nextPageToken) {
          playlistUrl += `&pageToken=${nextPageToken}`;
        }

        const playlistResponse = await fetch(playlistUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!playlistResponse.ok) {
          const errorData = await playlistResponse.text();
          this.logger.error(`Failed to fetch playlist items: ${errorData}`);
          throw new BadRequestException("Failed to fetch playlist items");
        }

        const playlistData = await playlistResponse.json();

        if (!playlistData.items || playlistData.items.length === 0) {
          break;
        }

        const videoIds = playlistData.items
          .map((item: any) => item.contentDetails?.videoId)
          .filter((id: string) => id)
          .join(",");

        if (!videoIds) {
          nextPageToken = playlistData.nextPageToken;
          continue;
        }

        // Fetch detailed information for this batch of videos
        const detailsResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails,status&id=${videoIds}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!detailsResponse.ok) {
          const errorData = await detailsResponse.text();
          this.logger.error(`Failed to fetch video details: ${errorData}`);
          break;
        }

        const detailsData = await detailsResponse.json();

        for (const video of detailsData.items || []) {
          const snippet = video.snippet || {};
          const statistics = video.statistics || {};
          const contentDetails = video.contentDetails || {};
          const status = video.status || {};

          const privacyStatus = status.privacyStatus || "private";
          const statusMap: Record<string, "public" | "unlisted" | "private"> = {
            public: "public",
            unlisted: "unlisted",
            private: "private",
          };

          videos.push({
            id: video.id,
            title: snippet.title || "Untitled Video",
            description: snippet.description || "",
            thumbnail:
              snippet.thumbnails?.high?.url ||
              snippet.thumbnails?.default?.url ||
              "",
            duration: contentDetails.duration || "PT0S",
            publishedAt: snippet.publishedAt || new Date().toISOString(),
            status: statusMap[privacyStatus] || "private",
            viewCount: parseInt(statistics.viewCount || "0", 10),
            likeCount: parseInt(statistics.likeCount || "0", 10),
            commentCount: parseInt(statistics.commentCount || "0", 10),
          });
        }

        nextPageToken = playlistData.nextPageToken;
      } while (nextPageToken);

      const publicCount = videos.filter((v) => v.status === "public").length;
      const unlistedCount = videos.filter(
        (v) => v.status === "unlisted"
      ).length;
      const privateCount = videos.filter((v) => v.status === "private").length;

      this.logger.log(
        `Fetched ${videos.length} videos from channel ${channelId} (${publicCount} public, ${unlistedCount} unlisted, ${privateCount} private)`
      );

      return videos;
    } catch (error) {
      this.logger.error("Error getting channel videos:", error);
      throw error;
    }
  }

  private async exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const backendUrl =
      process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
    const redirectUri =
      process.env.YOUTUBE_REDIRECT_URI || `${backendUrl}/api/youtube/callback`;

    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        "YouTube client credentials not configured. Please set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET environment variables."
      );
    }

    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        this.logger.error(`Token exchange failed: ${errorData}`);
        throw new BadRequestException(
          "Failed to exchange authorization code for tokens"
        );
      }

      const data = await response.json();

      if (!data.access_token) {
        throw new BadRequestException("No access token received from YouTube");
      }

      this.logger.log("Successfully exchanged code for tokens");
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in || 3600,
      };
    } catch (error) {
      this.logger.error("Error exchanging code for tokens:", error);
      throw error;
    }
  }

  async refreshTokenIfNeeded(user: User): Promise<string> {
    if (
      !user.youtubeTokenExpiresAt ||
      new Date() < user.youtubeTokenExpiresAt
    ) {
      return user.youtubeAccessToken;
    }

    if (!user.youtubeRefreshToken) {
      throw new BadRequestException(
        "No refresh token available. Please reconnect your YouTube account."
      );
    }

    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        "YouTube client credentials not configured for token refresh"
      );
    }

    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: user.youtubeRefreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        this.logger.error(`Token refresh failed: ${errorData}`);
        throw new BadRequestException("Failed to refresh YouTube access token");
      }

      const data = await response.json();

      if (!data.access_token) {
        throw new BadRequestException("No access token received from refresh");
      }

      await this.userRepository.update(user.id, {
        youtubeAccessToken: data.access_token,
        youtubeTokenExpiresAt: new Date(
          Date.now() + (data.expires_in || 3600) * 1000
        ),
      });

      this.logger.log("Successfully refreshed YouTube access token");
      return data.access_token;
    } catch (error) {
      this.logger.error("Error refreshing token:", error);
      throw error;
    }
  }

  private async updateUserYouTubeCredentials(
    userId: string,
    credentials: {
      youtubeChannelId: string;
      youtubeAccessToken: string;
      youtubeRefreshToken: string;
      youtubeTokenExpiresAt: Date;
    }
  ): Promise<void> {
    await this.userRepository.update(userId, credentials);
  }

  private async createVideoFromYouTubeData(
    userId: string,
    videoData: YouTubeVideoData
  ): Promise<Video> {
    const video = this.videoRepository.create({
      youtubeId: videoData.id,
      title: videoData.title,
      description: videoData.description,
      thumbnail: videoData.thumbnail,
      duration: videoData.duration,
      status: this.mapYouTubeStatusToVideoStatus(videoData.status),
      visibility: this.mapYouTubeStatusToVideoVisibility(videoData.status),
      viewCount: videoData.viewCount,
      likeCount: videoData.likeCount,
      commentCount: videoData.commentCount,
      publishedAt: new Date(videoData.publishedAt),
      lastSyncedAt: new Date(),
      creatorId: userId,
    });

    return await this.videoRepository.save(video);
  }

  private async updateVideoFromYouTubeData(
    video: Video,
    videoData: YouTubeVideoData
  ): Promise<void> {
    video.title = videoData.title;
    video.description = videoData.description;
    video.thumbnail = videoData.thumbnail;
    video.duration = videoData.duration;
    video.status = this.mapYouTubeStatusToVideoStatus(videoData.status);
    video.visibility = this.mapYouTubeStatusToVideoVisibility(videoData.status);
    video.viewCount = videoData.viewCount;
    video.likeCount = videoData.likeCount;
    video.commentCount = videoData.commentCount;
    video.lastSyncedAt = new Date();

    // Update publishedAt when video transitions from unlisted to public
    if (
      videoData.status === "public" &&
      video.status === VideoStatus.UNLISTED
    ) {
      video.publishedAt = new Date(videoData.publishedAt);
    }

    await this.videoRepository.save(video);
  }

  private mapYouTubeStatusToVideoStatus(youtubeStatus: string): VideoStatus {
    switch (youtubeStatus) {
      case "public":
        return VideoStatus.PUBLIC;
      case "unlisted":
        return VideoStatus.UNLISTED;
      case "private":
        return VideoStatus.PRIVATE;
      default:
        return VideoStatus.UNLISTED;
    }
  }

  private mapYouTubeStatusToVideoVisibility(
    youtubeStatus: string
  ): VideoVisibility {
    switch (youtubeStatus) {
      case "public":
        return VideoVisibility.PUBLIC;
      case "unlisted":
        return VideoVisibility.UNLISTED;
      case "private":
        return VideoVisibility.PRIVATE;
      default:
        return VideoVisibility.UNLISTED;
    }
  }

  async isYouTubeConnected(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ["youtubeChannelId", "youtubeAccessToken"],
    });

    return !!(user?.youtubeChannelId && user?.youtubeAccessToken);
  }

  async disconnectYouTube(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      youtubeChannelId: null,
      youtubeAccessToken: null,
      youtubeRefreshToken: null,
      youtubeTokenExpiresAt: null,
    });

    this.logger.log(`YouTube channel disconnected for user ${userId}`);
  }

  async testYouTubeConnection(userId: string): Promise<{
    success: boolean;
    message: string;
    details: string;
    tests: Array<{
      name: string;
      passed: boolean;
      message: string;
      details?: any;
    }>;
  }> {
    const tests: Array<{
      name: string;
      passed: boolean;
      message: string;
      details?: any;
    }> = [];

    this.logger.log(`Starting YouTube connection test for user ${userId}`);

    let user: User | null = null;
    try {
      user = await this.userRepository.findOne({
        where: { id: userId },
        select: [
          "id",
          "email",
          "youtubeChannelId",
          "youtubeAccessToken",
          "youtubeRefreshToken",
          "youtubeTokenExpiresAt",
        ],
      });

      tests.push({
        name: "User exists",
        passed: !!user,
        message: user ? "User found" : "User not found",
      });
    } catch (error) {
      tests.push({
        name: "User exists",
        passed: false,
        message: `Error checking user: ${error.message}`,
      });
      return this.createTestResult(false, "User check failed", tests);
    }

    const hasCredentials = !!(
      user?.youtubeChannelId && user?.youtubeAccessToken
    );
    tests.push({
      name: "Credentials stored",
      passed: hasCredentials,
      message: hasCredentials
        ? "YouTube credentials found in database"
        : "No YouTube credentials found",
      details: {
        hasChannelId: !!user?.youtubeChannelId,
        hasAccessToken: !!user?.youtubeAccessToken,
        hasRefreshToken: !!user?.youtubeRefreshToken,
        channelId: user?.youtubeChannelId || "N/A",
      },
    });

    if (!hasCredentials) {
      return this.createTestResult(
        false,
        "No YouTube credentials found. Please connect your YouTube account first.",
        tests
      );
    }

    const tokenExpired =
      !user?.youtubeTokenExpiresAt || new Date() >= user.youtubeTokenExpiresAt;
    tests.push({
      name: "Token expiration check",
      passed: !tokenExpired,
      message: tokenExpired
        ? "Access token is expired (will be refreshed if refresh token available)"
        : "Access token is still valid",
      details: {
        expiresAt: user?.youtubeTokenExpiresAt?.toISOString() || "N/A",
        isExpired: tokenExpired,
      },
    });

    let accessToken: string | null = null;
    try {
      accessToken = await this.refreshTokenIfNeeded(user);
      tests.push({
        name: "Get valid access token",
        passed: !!accessToken,
        message: accessToken
          ? "Successfully obtained valid access token"
          : "Failed to get access token",
        details: {
          tokenLength: accessToken ? accessToken.length : 0,
          wasRefreshed: tokenExpired && !!user?.youtubeRefreshToken,
        },
      });
    } catch (error) {
      tests.push({
        name: "Get valid access token",
        passed: false,
        message: `Error getting token: ${error.message}`,
      });
      return this.createTestResult(
        false,
        "Failed to get valid access token",
        tests
      );
    }

    if (!accessToken) {
      return this.createTestResult(
        false,
        "Could not obtain valid access token",
        tests
      );
    }

    try {
      const channelInfo = await this.getChannelInfo(accessToken);
      tests.push({
        name: "YouTube API access - Channel info",
        passed: true,
        message: "Successfully fetched channel information from YouTube API",
        details: {
          channelId: channelInfo.id,
          channelTitle: channelInfo.title,
          videoCount: channelInfo.videoCount,
          subscriberCount: channelInfo.subscriberCount,
        },
      });
    } catch (error) {
      tests.push({
        name: "YouTube API access - Channel info",
        passed: false,
        message: `Failed to fetch channel info: ${error.message}`,
      });
      return this.createTestResult(
        false,
        "YouTube API access failed - Channel info",
        tests
      );
    }

    try {
      const videos = await this.getChannelVideos(
        accessToken,
        user.youtubeChannelId
      );
      const publicCount = videos.filter((v) => v.status === "public").length;
      const unlistedCount = videos.filter(
        (v) => v.status === "unlisted"
      ).length;
      const privateCount = videos.filter((v) => v.status === "private").length;

      tests.push({
        name: "YouTube API access - Fetch videos",
        passed: true,
        message: `Successfully fetched ${videos.length} videos from channel`,
        details: {
          totalVideos: videos.length,
          public: publicCount,
          unlisted: unlistedCount,
          private: privateCount,
        },
      });
    } catch (error) {
      tests.push({
        name: "YouTube API access - Fetch videos",
        passed: false,
        message: `Failed to fetch videos: ${error.message}`,
      });
      return this.createTestResult(
        false,
        "YouTube API access failed - Videos fetch",
        tests
      );
    }

    try {
      const storedVideos = await this.videoRepository.find({
        where: { creatorId: userId },
      });
      tests.push({
        name: "Database integration",
        passed: true,
        message: `Found ${storedVideos.length} videos stored in database`,
        details: {
          storedVideoCount: storedVideos.length,
        },
      });
    } catch (error) {
      tests.push({
        name: "Database integration",
        passed: false,
        message: `Error checking database: ${error.message}`,
      });
    }

    const allPassed = tests.every((test) => test.passed);
    return this.createTestResult(
      allPassed,
      allPassed
        ? "✅ All connection tests passed! YouTube integration is working correctly."
        : "⚠️ Some tests failed, but core functionality may still work",
      tests
    );
  }

  private createTestResult(
    success: boolean,
    message: string,
    tests: Array<{
      name: string;
      passed: boolean;
      message: string;
      details?: any;
    }>
  ): {
    success: boolean;
    message: string;
    details: string;
    tests: Array<{
      name: string;
      passed: boolean;
      message: string;
      details?: any;
    }>;
  } {
    const passedCount = tests.filter((t) => t.passed).length;
    const failedCount = tests.filter((t) => !t.passed).length;

    return {
      success,
      message,
      details: `Passed: ${passedCount}/${tests.length} tests. Failed: ${failedCount} test(s).`,
      tests,
    };
  }
}
