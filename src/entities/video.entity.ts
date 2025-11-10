import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { User } from "./user.entity";
import { Pool } from "./pool.entity";

export enum VideoStatus {
  UNLISTED = "unlisted", // Video is unlisted - pool creation phase
  PRIVATE = "private", // Video is private
  PUBLIC = "public", // Video is public - tracking phase
  DELETED = "deleted", // Video was deleted
}

export enum VideoVisibility {
  UNLISTED = "unlisted",
  PRIVATE = "private",
  PUBLIC = "public",
}

@Entity("videos")
export class Video {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", unique: true })
  youtubeId: string;

  @Column({ type: "varchar" })
  title: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "varchar" })
  thumbnail: string;

  @Column({
    type: "enum",
    enum: VideoStatus,
    default: VideoStatus.UNLISTED,
  })
  status: VideoStatus;

  @Column({
    type: "enum",
    enum: VideoVisibility,
    default: VideoVisibility.UNLISTED,
  })
  visibility: VideoVisibility;

  // YouTube Metrics
  @Column({ type: "int", default: 0 })
  viewCount: number;

  @Column({ type: "int", default: 0 })
  likeCount: number;

  @Column({ type: "int", default: 0 })
  commentCount: number;

  @Column({ type: "varchar" })
  duration: string;

  @Column({ type: "timestamp", nullable: true })
  publishedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  lastSyncedAt: Date;

  // Milestone tracking fields (for analytics and suggestions)
  @Column({ type: "int", nullable: true })
  views24h: number; // Views 24 hours after publication

  @Column({ type: "int", nullable: true })
  views48h: number; // Views 48 hours after publication

  @Column({ type: "int", nullable: true })
  views7d: number; // Views 7 days after publication

  @Column({ type: "int", nullable: true })
  views30d: number; // Views 30 days after publication

  @Column({ type: "timestamp", nullable: true })
  milestone24hCapturedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  milestone48hCapturedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  milestone7dCapturedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  milestone30dCapturedAt: Date;

  // Pool-related fields
  @Column({ type: "boolean", default: false })
  hasActivePool: boolean;

  @Column({ type: "timestamp", nullable: true })
  poolCreatedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  poolClosedAt: Date;

  // Creator relationship
  @Column({ type: "uuid" })
  creatorId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.videos, { onDelete: "CASCADE" })
  @JoinColumn({ name: "creatorId" })
  creator: User;

  @OneToMany(() => Pool, (pool) => pool.video)
  pools: Pool[];

  // Helper methods
  isUnlisted(): boolean {
    return (
      this.status === VideoStatus.UNLISTED &&
      this.visibility === VideoVisibility.UNLISTED
    );
  }

  isPublic(): boolean {
    return (
      this.status === VideoStatus.PUBLIC &&
      this.visibility === VideoVisibility.PUBLIC
    );
  }

  canCreatePool(): boolean {
    return this.isUnlisted() && !this.hasActivePool;
  }

  isTrackingEligible(): boolean {
    return this.isPublic() && this.hasActivePool;
  }

  // Calculate time since publication for tracking
  getTimeSincePublication(): number {
    if (!this.publishedAt) return 0;
    return Date.now() - this.publishedAt.getTime();
  }

  // Get hours since publication
  getHoursSincePublication(): number {
    return Math.floor(this.getTimeSincePublication() / (1000 * 60 * 60));
  }

  /**
   * Parse ISO 8601 duration (PT format) to seconds
   * Examples:
   * - PT15S = 15 seconds
   * - PT1M30S = 90 seconds
   * - PT2H15M30S = 8130 seconds
   * - PT1H = 3600 seconds
   */
  getDurationInSeconds(): number {
    if (!this.duration || !this.duration.startsWith("PT")) {
      return 0;
    }

    const duration = this.duration.replace("PT", "");
    let seconds = 0;

    // Match hours (H), minutes (M), and seconds (S)
    const hoursMatch = duration.match(/(\d+)H/);
    const minutesMatch = duration.match(/(\d+)M/);
    const secondsMatch = duration.match(/(\d+)S/);

    if (hoursMatch) {
      seconds += parseInt(hoursMatch[1], 10) * 3600;
    }
    if (minutesMatch) {
      seconds += parseInt(minutesMatch[1], 10) * 60;
    }
    if (secondsMatch) {
      seconds += parseInt(secondsMatch[1], 10);
    }

    return seconds;
  }

  /**
   * Get duration in human-readable format (e.g., "2h 15m 30s" or "1:30")
   * @param format - 'full' for "2h 15m 30s" or 'compact' for "2:15:30" or 'short' for "1:30"
   */
  getDurationFormatted(format: "full" | "compact" | "short" = "full"): string {
    const seconds = this.getDurationInSeconds();
    if (seconds === 0) return "0s";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (format === "compact") {
      if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      }
      return `${minutes}:${String(secs).padStart(2, "0")}`;
    }

    if (format === "short") {
      if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      }
      return `${minutes}:${String(secs).padStart(2, "0")}`;
    }

    // Full format: "2h 15m 30s"
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    return parts.join(" ");
  }

  /**
   * Get duration in minutes (rounded)
   */
  getDurationInMinutes(): number {
    return Math.round(this.getDurationInSeconds() / 60);
  }
}
