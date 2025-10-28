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
}
