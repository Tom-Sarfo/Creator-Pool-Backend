import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  OneToMany,
} from "typeorm";
import * as bcrypt from "bcrypt";

export enum UserRole {
  USER = "user", // Default role for all users (predictors)
  CREATOR = "creator",
  ADMIN = "admin",
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", unique: true })
  email: string;

  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "varchar", select: false, nullable: true })
  password: string;

  @Column({
    type: "enum",
    enum: UserRole,
  })
  role: UserRole;

  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    default: 0,
  })
  walletBalance: number;

  // Google OAuth
  @Column({ type: "varchar", nullable: true })
  googleId: string;

  // YouTube Integration (for creators)
  @Column({ type: "varchar", nullable: true })
  youtubeChannelId: string;

  @Column({ type: "varchar", select: false, nullable: true })
  youtubeAccessToken: string;

  @Column({ type: "varchar", select: false, nullable: true })
  youtubeRefreshToken: string;

  @Column({ type: "timestamp", nullable: true })
  youtubeTokenExpiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations (will be added when entities are created)
  // @OneToMany(() => Video, (video) => video.creator)
  // videos: Video[];

  // @OneToMany(() => Pool, (pool) => pool.creator)
  // pools: Pool[];

  // @OneToMany(() => Prediction, (prediction) => prediction.predictor)
  // predictions: Prediction[];

  // @OneToMany(() => Transaction, (transaction) => transaction.user)
  // transactions: Transaction[];

  @BeforeInsert()
  async hashPassword() {
    if (this.password) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }
}
