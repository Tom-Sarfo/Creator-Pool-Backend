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

export enum TransactionType {
  DEPOSIT = "deposit", // User adds funds to wallet
  WITHDRAWAL = "withdrawal", // User withdraws funds from wallet
  STAKE = "stake", // Predictor deposits stake to escrow
  PLEDGE = "pledge", // Creator deposits pledge to escrow
  WINNINGS = "winnings", // Winner receives payout from escrow
  ROYALTY = "royalty", // Creator receives royalty from escrow
  PLATFORM_FEE = "platform_fee", // Platform fee collected (tracked but not paid to user)
  REFUND = "refund", // Refund escrowed funds (e.g., if pool is cancelled)
}

export enum TransactionStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
}

@Entity("transactions")
export class Transaction {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "uuid", nullable: true })
  poolId: string;

  @Column({
    type: "enum",
    enum: TransactionType,
  })
  type: TransactionType;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: "enum",
    enum: TransactionStatus,
    default: TransactionStatus.COMPLETED,
  })
  status: TransactionStatus;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "varchar", nullable: true })
  reference: string; // For external payment processor IDs

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.transactions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @ManyToOne(() => Pool, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "poolId" })
  pool: Pool;
}


