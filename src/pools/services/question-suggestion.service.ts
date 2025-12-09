import { Injectable, Logger, Inject } from "@nestjs/common";
import { Video } from "../../entities/video.entity";
import {
  CreatorAnalyticsService,
  AverageViews,
} from "./creator-analytics.service";

export interface QuestionSuggestion {
  question: string;
  targetViews: number;
  trackingDurationDays: number;
  description: string;
  type: "comparison" | "average";
}

export interface SuggestionResponse {
  suggestions: QuestionSuggestion[];
  analytics: {
    avg24hViews: number | null;
    avg48hViews: number | null;
    avg7dViews: number | null;
    avg30dViews: number | null;
    sampleSize: number;
    hasEnoughData: boolean;
  };
  creatorStats: {
    totalVideos: number;
    videosWithMilestones: number;
  };
}

@Injectable()
export class QuestionSuggestionService {
  private readonly logger = new Logger(QuestionSuggestionService.name);

  constructor(
    @Inject(CreatorAnalyticsService)
    private creatorAnalyticsService: CreatorAnalyticsService
  ) {}

  /**
   * Generate question suggestions for a creator
   */
  async generateSuggestions(
    creatorId: string,
    videoId?: string
  ): Promise<SuggestionResponse> {
    // Get creator stats to determine which approach to use
    const creatorStats =
      await this.creatorAnalyticsService.getCreatorVideoStats(creatorId);
    const averages =
      await this.creatorAnalyticsService.calculateAverageViews(creatorId);

    const hasEnoughData = averages.sampleSize >= 10;

    let suggestions: QuestionSuggestion[];

    if (hasEnoughData && averages.avg24hViews !== null) {
      // Use average-based suggestions for creators with 10+ videos
      suggestions = await this.generateAverageSuggestions(creatorId, averages);
    } else {
      // Use comparison-based suggestions for new creators (<10 videos)
      const recentVideos = await this.creatorAnalyticsService.getRecentVideos(
        creatorId,
        3
      );
      suggestions = await this.generateComparisonSuggestions(
        creatorId,
        recentVideos
      );
    }

    // Limit to 5 suggestions
    suggestions = suggestions.slice(0, 5);

    return {
      suggestions,
      analytics: {
        ...averages,
        hasEnoughData,
      },
      creatorStats,
    };
  }

  /**
   * Generate comparison-based suggestions for creators with <10 videos
   * Compares to last 2-3 videos
   */
  private async generateComparisonSuggestions(
    creatorId: string,
    recentVideos: Video[]
  ): Promise<QuestionSuggestion[]> {
    const suggestions: QuestionSuggestion[] = [];

    if (recentVideos.length === 0) {
      // No videos to compare against
      return suggestions;
    }

    // Calculate average of last 2-3 videos' 7d views (or current viewCount if 7d not available)
    const videoViews = recentVideos.map((v) => {
      // Prefer 7d milestone, fallback to current viewCount
      return v.views7d !== null && v.views7d !== undefined
        ? v.views7d
        : v.viewCount;
    });

    const avgRecentViews =
      videoViews.reduce((sum, views) => sum + views, 0) / videoViews.length;

    const lastVideoViews = videoViews[0]; // Most recent video

    // Suggestion 1: Compare to average of last videos (7 days)
    if (recentVideos.length >= 2 && avgRecentViews > 0) {
      suggestions.push({
        question: `Will this video reach ${this.formatNumber(
          Math.round(avgRecentViews)
        )} views in 7 days?`,
        targetViews: Math.round(avgRecentViews),
        trackingDurationDays: 7,
        description: `Based on average of your last ${recentVideos.length} videos`,
        type: "comparison",
      });
    }

    // Suggestion 2: Compare to last video (7 days)
    if (lastVideoViews > 0) {
      suggestions.push({
        question: `Will this video get more views than your last video? (Last: ${this.formatNumber(lastVideoViews)})`,
        targetViews: Math.round(lastVideoViews * 1.1), // 10% above last video
        trackingDurationDays: 7,
        description: `10% above your last video's performance`,
        type: "comparison",
      });
    }

    // Suggestion 3: 20% growth target
    if (lastVideoViews > 0) {
      suggestions.push({
        question: `Will this video reach ${this.formatNumber(
          Math.round(lastVideoViews * 1.2)
        )} views in 7 days?`,
        targetViews: Math.round(lastVideoViews * 1.2),
        trackingDurationDays: 7,
        description: `20% growth from your last video`,
        type: "comparison",
      });
    }

    // Suggestion 4: 50% growth target
    if (lastVideoViews > 0) {
      suggestions.push({
        question: `Will this video outperform your last video by 50%? (Target: ${this.formatNumber(Math.round(lastVideoViews * 1.5))} views)`,
        targetViews: Math.round(lastVideoViews * 1.5),
        trackingDurationDays: 7,
        description: `50% growth target`,
        type: "comparison",
      });
    }

    // Suggestion 5: 24h target (if we have 24h data from last video)
    if (recentVideos[0]?.views24h && recentVideos[0].views24h > 0) {
      suggestions.push({
        question: `Will this video reach ${this.formatNumber(
          recentVideos[0].views24h
        )} views in 24 hours?`,
        targetViews: recentVideos[0].views24h,
        trackingDurationDays: 1,
        description: `Based on your last video's 24-hour performance`,
        type: "comparison",
      });
    }

    return suggestions;
  }

  /**
   * Generate average-based suggestions for creators with 10+ videos
   */
  private async generateAverageSuggestions(
    creatorId: string,
    averages: AverageViews
  ): Promise<QuestionSuggestion[]> {
    const suggestions: QuestionSuggestion[] = [];

    // Suggestion 1: 24-hour target
    if (averages.avg24hViews !== null && averages.avg24hViews > 0) {
      suggestions.push({
        question: `Will this video reach ${this.formatNumber(
          averages.avg24hViews
        )} views in the first 24 hours?`,
        targetViews: averages.avg24hViews,
        trackingDurationDays: 1,
        description: `Based on your average of ${this.formatNumber(
          averages.avg24hViews
        )} views in 24 hours`,
        type: "average",
      });

      // Variation: 1.2x 24h average
      suggestions.push({
        question: `Will this video reach ${this.formatNumber(
          Math.round(averages.avg24hViews * 1.2)
        )} views in 24 hours?`,
        targetViews: Math.round(averages.avg24hViews * 1.2),
        trackingDurationDays: 1,
        description: `20% above your 24-hour average`,
        type: "average",
      });
    }

    // Suggestion 2: 7-day target
    if (averages.avg7dViews !== null && averages.avg7dViews > 0) {
      suggestions.push({
        question: `Will this video reach ${this.formatNumber(
          averages.avg7dViews
        )} views in 7 days?`,
        targetViews: averages.avg7dViews,
        trackingDurationDays: 7,
        description: `Based on your average of ${this.formatNumber(
          averages.avg7dViews
        )} views in 7 days`,
        type: "average",
      });

      // Variation: 1.5x 7d average
      suggestions.push({
        question: `Will this video outperform your 7-day average and reach ${this.formatNumber(
          Math.round(averages.avg7dViews * 1.5)
        )} views?`,
        targetViews: Math.round(averages.avg7dViews * 1.5),
        trackingDurationDays: 7,
        description: `50% above your 7-day average`,
        type: "average",
      });

      // Variation: 2x 7d average
      suggestions.push({
        question: `Will this video double your 7-day average and reach ${this.formatNumber(
          Math.round(averages.avg7dViews * 2)
        )} views?`,
        targetViews: Math.round(averages.avg7dViews * 2),
        trackingDurationDays: 7,
        description: `Double your 7-day average`,
        type: "average",
      });
    }

    // Suggestion 3: 30-day target
    if (averages.avg30dViews !== null && averages.avg30dViews > 0) {
      suggestions.push({
        question: `Will this video reach ${this.formatNumber(
          averages.avg30dViews
        )} views in 30 days?`,
        targetViews: averages.avg30dViews,
        trackingDurationDays: 30,
        description: `Based on your average of ${this.formatNumber(
          averages.avg30dViews
        )} views in 30 days`,
        type: "average",
      });
    }

    // Suggestion 4: 48-hour target
    if (averages.avg48hViews !== null && averages.avg48hViews > 0) {
      suggestions.push({
        question: `Will this video reach ${this.formatNumber(
          averages.avg48hViews
        )} views in 48 hours?`,
        targetViews: averages.avg48hViews,
        trackingDurationDays: 2,
        description: `Based on your average of ${this.formatNumber(
          averages.avg48hViews
        )} views in 48 hours`,
        type: "average",
      });
    }

    return suggestions;
  }

  /**
   * Format number for display (e.g., 1500 -> "1.5K", 2300000 -> "2.3M")
   */
  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return Math.round(num).toString();
  }
}









