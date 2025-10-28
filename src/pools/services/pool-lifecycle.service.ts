import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Pool, PoolStatus, PoolResult } from "../../entities/pool.entity";
import { Video, VideoStatus } from "../../entities/video.entity";

@Injectable()
export class PoolLifecycleService {
  private readonly logger = new Logger(PoolLifecycleService.name);

  constructor(
    @InjectRepository(Pool)
    private poolRepository: Repository<Pool>,
    @InjectRepository(Video)
    private videoRepository: Repository<Video>
  ) {}

  /**
   * Check and update pool statuses based on their lifecycle
   * This should be called periodically (every 30 seconds)
   */
  async updatePoolStatuses(): Promise<void> {
    this.logger.log("Updating pool statuses...");

    try {
      // 1. Close pools that have exceeded their prediction window
      await this.closeExpiredPredictionWindows();

      // 2. Start tracking pools whose videos have gone public
      await this.startTrackingForPublishedVideos();

      // 3. Close pools that have exceeded their tracking period
      await this.closeExpiredTrackingPeriods();

      // 4. Settle pools that are ready for settlement
      await this.settleReadyPools();

      this.logger.log("Pool status updates completed");
    } catch (error) {
      this.logger.error("Error updating pool statuses:", error);
    }
  }

  /**
   * Close pools that have exceeded their prediction window
   */
  private async closeExpiredPredictionWindows(): Promise<void> {
    const now = new Date();

    const expiredPools = await this.poolRepository
      .createQueryBuilder("pool")
      .where("pool.status = :status", { status: PoolStatus.OPEN })
      .andWhere("pool.closesAt < :now", { now })
      .getMany();

    for (const pool of expiredPools) {
      await this.closePredictionWindow(pool);
    }

    if (expiredPools.length > 0) {
      this.logger.log(
        `Closed ${expiredPools.length} pools with expired prediction windows`
      );
    }
  }

  /**
   * Start tracking for pools whose videos have gone public
   */
  private async startTrackingForPublishedVideos(): Promise<void> {
    const poolsAwaitingRelease = await this.poolRepository.find({
      where: { status: PoolStatus.AWAITING_RELEASE },
      relations: ["video"],
    });

    for (const pool of poolsAwaitingRelease) {
      if (pool.video && pool.video.isPublic()) {
        await this.startLiveTracking(pool);
      }
    }

    if (poolsAwaitingRelease.length > 0) {
      this.logger.log(
        `Checked ${poolsAwaitingRelease.length} pools awaiting release`
      );
    }
  }

  /**
   * Close pools that have exceeded their tracking period
   */
  private async closeExpiredTrackingPeriods(): Promise<void> {
    const now = new Date();

    const expiredTrackingPools = await this.poolRepository
      .createQueryBuilder("pool")
      .where("pool.status = :status", { status: PoolStatus.LIVE_TRACKING })
      .andWhere(
        "pool.trackingStartedAt + INTERVAL '1 day' * pool.trackingDurationDays < :now",
        { now }
      )
      .getMany();

    for (const pool of expiredTrackingPools) {
      await this.closeTrackingPeriod(pool);
    }

    if (expiredTrackingPools.length > 0) {
      this.logger.log(
        `Closed ${expiredTrackingPools.length} pools with expired tracking periods`
      );
    }
  }

  /**
   * Settle pools that are ready for settlement
   */
  private async settleReadyPools(): Promise<void> {
    const closedPools = await this.poolRepository.find({
      where: { status: PoolStatus.CLOSED },
      relations: ["video", "predictions"],
    });

    for (const pool of closedPools) {
      await this.settlePool(pool);
    }

    if (closedPools.length > 0) {
      this.logger.log(`Settled ${closedPools.length} pools`);
    }
  }

  /**
   * Close the prediction window for a pool
   */
  async closePredictionWindow(pool: Pool): Promise<void> {
    this.logger.log(`Closing prediction window for pool ${pool.id}`);

    pool.status = PoolStatus.AWAITING_RELEASE;
    pool.closesAt = new Date();

    await this.poolRepository.save(pool);

    this.logger.log(`Pool ${pool.id} is now awaiting video release`);
  }

  /**
   * Start live tracking for a pool
   */
  async startLiveTracking(pool: Pool): Promise<void> {
    this.logger.log(`Starting live tracking for pool ${pool.id}`);

    pool.status = PoolStatus.LIVE_TRACKING;
    pool.publishedAt = new Date();
    pool.trackingStartedAt = new Date();

    await this.poolRepository.save(pool);

    this.logger.log(`Pool ${pool.id} is now live tracking`);
  }

  /**
   * Close the tracking period for a pool
   */
  async closeTrackingPeriod(pool: Pool): Promise<void> {
    this.logger.log(`Closing tracking period for pool ${pool.id}`);

    pool.status = PoolStatus.CLOSED;
    pool.closedAt = new Date();

    await this.poolRepository.save(pool);

    this.logger.log(`Pool ${pool.id} tracking period closed`);
  }

  /**
   * Settle a pool and determine winners
   */
  async settlePool(pool: Pool): Promise<void> {
    this.logger.log(`Settling pool ${pool.id}`);

    try {
      // Determine the result based on current views vs target
      const result = pool.hasMetTarget()
        ? PoolResult.YES_WON
        : PoolResult.NO_WON;

      pool.result = result;
      pool.status = PoolStatus.SETTLED;
      pool.settledAt = new Date();

      // Calculate payouts (simplified for now)
      await this.calculatePayouts(pool);

      await this.poolRepository.save(pool);

      this.logger.log(`Pool ${pool.id} settled with result: ${result}`);
    } catch (error) {
      this.logger.error(`Error settling pool ${pool.id}:`, error);
      throw error;
    }
  }

  /**
   * Calculate payouts for pool participants
   */
  private async calculatePayouts(pool: Pool): Promise<void> {
    // This is a simplified payout calculation
    // In production, you'd implement the full parimutuel betting logic

    const winningChoice = pool.result === PoolResult.YES_WON ? "yes" : "no";
    const losingChoice = pool.result === PoolResult.NO_WON ? "yes" : "no";

    const winningStake = winningChoice === "yes" ? pool.yesStake : pool.noStake;
    const losingStake = losingChoice === "yes" ? pool.yesStake : pool.noStake;

    // Calculate platform fee (5%) and creator royalty (1%)
    const platformFee = Number(losingStake) * 0.05;
    const creatorRoyalty = Number(losingStake) * 0.01;
    const netPayout = Number(losingStake) - platformFee - creatorRoyalty;

    pool.creatorEarnings = creatorRoyalty;

    this.logger.log(`Pool ${pool.id} payout calculation:`, {
      winningStake: Number(winningStake),
      losingStake: Number(losingStake),
      netPayout: Number(netPayout),
      platformFee: Number(platformFee),
      creatorRoyalty: Number(creatorRoyalty),
    });
  }

  /**
   * Get pools by status
   */
  async getPoolsByStatus(status: PoolStatus): Promise<Pool[]> {
    return this.poolRepository.find({
      where: { status },
      relations: ["video", "creator"],
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Get active pools (open or live tracking)
   */
  async getActivePools(): Promise<Pool[]> {
    return this.poolRepository.find({
      where: [
        { status: PoolStatus.OPEN },
        { status: PoolStatus.LIVE_TRACKING },
      ],
      relations: ["video", "creator"],
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Get pools for a specific creator
   */
  async getCreatorPools(creatorId: string): Promise<Pool[]> {
    return this.poolRepository.find({
      where: { creatorId },
      relations: ["video"],
      order: { createdAt: "DESC" },
    });
  }
}
