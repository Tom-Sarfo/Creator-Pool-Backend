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
import { Video } from "./video.entity";
import { Prediction } from "./prediction.entity";

export enum PoolStatus {
  OPEN = "open", // Accepting predictions
  AWAITING_RELEASE = "awaiting_release", // Prediction window closed, waiting for video to go public
  LIVE_TRACKING = "live_tracking", // Video is public, tracking metrics
  CLOSED = "closed", // Tracking period ended
  SETTLED = "settled", // Results calculated and rewards distributed
}

export enum PoolResult {
  YES_WON = "yes_won", // Video met the target (e.g., reached view goal)
  NO_WON = "no_won", // Video didn't meet the target
  PENDING = "pending", // Still tracking
}

@Entity("pools")
export class Pool {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  videoId: string;

  @Column({ type: "uuid" })
  creatorId: string;

  @Column({ type: "text" })
  question: string;

  @Column({ type: "int" })
  targetViews: number;

  @Column({ type: "int", default: 7 })
  trackingDurationDays: number; // How long to track after publication

  @Column({ type: "int", default: 15 })
  predictionWindowMinutes: number; // How long predictions are accepted

  @Column({
    type: "enum",
    enum: PoolStatus,
    default: PoolStatus.OPEN,
  })
  status: PoolStatus;

  // Pool financials
  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  totalStake: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  creatorPledge: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  predictorStakes: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  yesStake: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  noStake: number;

  @Column({ type: "int", default: 0 })
  yesCount: number;

  @Column({ type: "int", default: 0 })
  noCount: number;

  @Column({ type: "int", default: 0 })
  participants: number;

  // Current tracking metrics
  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  currentViews: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  yesOdds: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  noOdds: number;

  // Results
  @Column({
    type: "enum",
    enum: PoolResult,
    default: PoolResult.PENDING,
  })
  result: PoolResult;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  creatorEarnings: number;

  // Timestamps for lifecycle management
  @Column({ type: "timestamp", nullable: true })
  closesAt: Date; // When prediction window closes

  @Column({ type: "timestamp", nullable: true })
  publishedAt: Date; // When video went public

  @Column({ type: "timestamp", nullable: true })
  trackingStartedAt: Date; // When live tracking began

  @Column({ type: "timestamp", nullable: true })
  closedAt: Date; // When tracking period ended

  @Column({ type: "timestamp", nullable: true })
  settledAt: Date; // When pool was settled

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Video, (video) => video.pools, { onDelete: "CASCADE" })
  @JoinColumn({ name: "videoId" })
  video: Video;

  @ManyToOne(() => User, (user) => user.pools, { onDelete: "CASCADE" })
  @JoinColumn({ name: "creatorId" })
  creator: User;

  @OneToMany(() => Prediction, (prediction) => prediction.pool)
  predictions: Prediction[];

  // Helper methods
  isOpen(): boolean {
    return this.status === PoolStatus.OPEN;
  }

  isAwaitingRelease(): boolean {
    return this.status === PoolStatus.AWAITING_RELEASE;
  }

  isLiveTracking(): boolean {
    return this.status === PoolStatus.LIVE_TRACKING;
  }

  isClosed(): boolean {
    return this.status === PoolStatus.CLOSED;
  }

  isSettled(): boolean {
    return this.status === PoolStatus.SETTLED;
  }

  // Check if prediction window is still open
  isPredictionWindowOpen(): boolean {
    if (!this.isOpen()) return false;
    if (!this.closesAt) return true;
    return new Date() < this.closesAt;
  }

  // Check if tracking period has ended
  isTrackingPeriodOver(): boolean {
    if (!this.trackingStartedAt) return false;
    const trackingEnd = new Date(this.trackingStartedAt);
    trackingEnd.setDate(trackingEnd.getDate() + this.trackingDurationDays);
    return new Date() > trackingEnd;
  }

  // Calculate time remaining in prediction window
  getPredictionTimeRemaining(): number {
    if (!this.isPredictionWindowOpen()) return 0;
    if (!this.closesAt) return this.predictionWindowMinutes * 60 * 1000;
    return Math.max(0, this.closesAt.getTime() - Date.now());
  }

  // Calculate time remaining in tracking period
  getTrackingTimeRemaining(): number {
    if (!this.isLiveTracking()) return 0;
    if (!this.trackingStartedAt) return 0;

    const trackingEnd = new Date(this.trackingStartedAt);
    trackingEnd.setDate(trackingEnd.getDate() + this.trackingDurationDays);

    return Math.max(0, trackingEnd.getTime() - Date.now());
  }

  // Check if video met the target
  hasMetTarget(): boolean {
    return this.currentViews >= this.targetViews;
  }
}
