import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";
import { Pool } from "./pool.entity";

export enum PredictionChoice {
  YES = "yes",
  NO = "no",
}

export enum PredictionResult {
  WON = "won",
  LOST = "lost",
  PENDING = "pending",
}

@Entity("predictions")
export class Prediction {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  poolId: string;

  @Column({ type: "uuid" })
  predictorId: string;

  @Column({
    type: "enum",
    enum: PredictionChoice,
  })
  choice: PredictionChoice;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  stake: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  potentialPayout: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  actualPayout: number;

  @Column({
    type: "enum",
    enum: PredictionResult,
    default: PredictionResult.PENDING,
  })
  result: PredictionResult;

  @Column({ type: "timestamp", nullable: true })
  settledAt: Date;

  @CreateDateColumn()
  predictedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Pool, (pool) => pool.predictions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "poolId" })
  pool: Pool;

  @ManyToOne(() => User, (user) => user.predictions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "predictorId" })
  predictor: User;

  // Helper methods
  isWon(): boolean {
    return this.result === PredictionResult.WON;
  }

  isLost(): boolean {
    return this.result === PredictionResult.LOST;
  }

  isPending(): boolean {
    return this.result === PredictionResult.PENDING;
  }

  // @deprecated - This method used odds-based calculation
  // Potential payout should be calculated using ProbabilityService.calculatePotentialPayout()
  calculatePotentialPayout(odds: number): number {
    return Number(this.stake) * (1 + odds);
  }

  // Check if this prediction won based on pool result
  checkWin(poolResult: string): boolean {
    if (poolResult === "yes_won") {
      return this.choice === PredictionChoice.YES;
    } else if (poolResult === "no_won") {
      return this.choice === PredictionChoice.NO;
    }
    return false;
  }
}
