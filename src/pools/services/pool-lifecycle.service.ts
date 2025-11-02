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
      // 1. Handle OPEN pools whose videos have gone public (transition to LIVE_TRACKING)
      await this.handleOpenPoolsWithPublicVideos();

      // 2. Close pools that have exceeded their prediction window
      await this.closeExpiredPredictionWindows();

      // 3. Start tracking pools whose videos have gone public (AWAITING_RELEASE -> LIVE_TRACKING)
      await this.startTrackingForPublishedVideos();

      // 4. Close pools that have exceeded their tracking period
      await this.closeExpiredTrackingPeriods();

      // 5. Settle pools that are ready for settlement (have pledge deposit)
      await this.settleReadyPools();

      this.logger.log("Pool status updates completed");
    } catch (error) {
      this.logger.error("Error updating pool statuses:", error);
    }
  }

  /**
   * Handle OPEN pools whose videos have gone public
   * Transition them to LIVE_TRACKING immediately (predictions end)
   */
  private async handleOpenPoolsWithPublicVideos(): Promise<void> {
    const openPools = await this.poolRepository.find({
      where: { status: PoolStatus.OPEN },
      relations: ["video"],
    });

    let transitionedCount = 0;

    for (const pool of openPools) {
      if (pool.video && pool.video.isPublic()) {
        await this.startLiveTracking(pool);
        transitionedCount++;
      }
    }

    if (transitionedCount > 0) {
      this.logger.log(
        `Transitioned ${transitionedCount} OPEN pools to LIVE_TRACKING (video went public)`
      );
    }
  }

  /**
   * Close pools that have exceeded their prediction window
   * Only transitions OPEN pools where video is still unlisted
   */
  private async closeExpiredPredictionWindows(): Promise<void> {
    const now = new Date();

    const expiredPools = await this.poolRepository
      .createQueryBuilder("pool")
      .leftJoinAndSelect("pool.video", "video")
      .where("pool.status = :status", { status: PoolStatus.OPEN })
      .andWhere("pool.closesAt IS NOT NULL")
      .andWhere("pool.closesAt < :now", { now })
      .getMany();

    let closedCount = 0;

    for (const pool of expiredPools) {
      try {
        // Only close if video is still unlisted (if public, it should have been handled by handleOpenPoolsWithPublicVideos)
        // Also handle case where video might be null or not loaded
        const isVideoUnlisted =
          !pool.video || (pool.video && !pool.video.isPublic());

        if (isVideoUnlisted) {
          await this.closePredictionWindow(pool);
          closedCount++;
        } else {
          this.logger.debug(
            `Pool ${pool.id} has expired window but video is public, skipping (should be handled by handleOpenPoolsWithPublicVideos)`
          );
        }
      } catch (error) {
        this.logger.error(
          `Error closing prediction window for pool ${pool.id}:`,
          error
        );
      }
    }

    if (closedCount > 0) {
      this.logger.log(
        `Closed ${closedCount} pools with expired prediction windows`
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
   * Only settle CLOSED pools that have a pledge deposit (creatorPledge > 0)
   */
  private async settleReadyPools(): Promise<void> {
    const closedPools = await this.poolRepository.find({
      where: { status: PoolStatus.CLOSED },
      relations: ["video", "predictions"],
    });

    let settledCount = 0;

    for (const pool of closedPools) {
      // Only settle pools that have a pledge deposit Note:; for futer use we should compare deposited value with pledged value if it same then we can settle pool
      if (Number(pool.creatorPledge) > 0) {
        await this.settlePool(pool);
        settledCount++;
      }
    }

    if (settledCount > 0) {
      this.logger.log(`Settled ${settledCount} pools with pledge deposits`);
    }
  }

  /**
   * Check and settle pools with pledge deposits
   * This can be called immediately after a pledge deposit
   */
  async checkAndSettlePoolsWithPledge(poolId: string): Promise<void> {
    const pool = await this.poolRepository.findOne({
      where: { id: poolId },
      relations: ["video", "predictions"],
    });

    if (!pool) {
      this.logger.warn(`Pool ${poolId} not found for settlement check`);
      return;
    }

    // Only settle if pool is CLOSED and has pledge
    if (pool.status === PoolStatus.CLOSED && Number(pool.creatorPledge) > 0) {
      await this.settlePool(pool);
      this.logger.log(`Pool ${poolId} settled after pledge deposit`);
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
   * Handle pool transitions when video goes public
   * Called when video status changes from unlisted to public
   */
  async handleVideoGoingPublic(videoId: string): Promise<void> {
    // Find all pools for this video that need to transition
    const pools = await this.poolRepository.find({
      where: { videoId },
      relations: ["video"],
    });

    for (const pool of pools) {
      if (pool.status === PoolStatus.OPEN && pool.video?.isPublic()) {
        // OPEN pool with public video -> transition to LIVE_TRACKING
        await this.startLiveTracking(pool);
        this.logger.log(
          `Pool ${pool.id} transitioned from OPEN to LIVE_TRACKING (video went public)`
        );
      } else if (
        pool.status === PoolStatus.AWAITING_RELEASE &&
        pool.video?.isPublic()
      ) {
        // AWAITING_RELEASE pool with public video -> transition to LIVE_TRACKING
        await this.startLiveTracking(pool);
        this.logger.log(
          `Pool ${pool.id} transitioned from AWAITING_RELEASE to LIVE_TRACKING (video went public)`
        );
      }
    }
  }

  /**
   * Start live tracking for a pool
   * If pool was OPEN, closes the prediction window (predictions end)
   */
  async startLiveTracking(pool: Pool): Promise<void> {
    this.logger.log(`Starting live tracking for pool ${pool.id}`);

    const wasOpen = pool.status === PoolStatus.OPEN;

    pool.status = PoolStatus.LIVE_TRACKING;
    pool.publishedAt = new Date();
    pool.trackingStartedAt = new Date();

    // If pool was OPEN, close the prediction window (predictions end when video goes public)
    if (wasOpen) {
      pool.closesAt = new Date();
      this.logger.log(
        `Pool ${pool.id} prediction window closed (video went public)`
      );
    }

    await this.poolRepository.save(pool);

    this.logger.log(`Pool ${pool.id} is now live tracking`);
  }

  /**
   * Close the tracking period for a pool
   * If pool has a pledge deposit, automatically settle it
   */
  async closeTrackingPeriod(pool: Pool): Promise<void> {
    this.logger.log(`Closing tracking period for pool ${pool.id}`);

    pool.status = PoolStatus.CLOSED;
    pool.closedAt = new Date();

    await this.poolRepository.save(pool);

    // If pool already has a pledge deposit, settle it immediately
    if (Number(pool.creatorPledge) > 0) {
      this.logger.log(
        `Pool ${pool.id} has pledge deposit, settling immediately`
      );
      await this.settlePool(pool);
    } else {
      this.logger.log(
        `Pool ${pool.id} tracking period closed (awaiting pledge deposit)`
      );
    }
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

  /**
   * Get pools awaiting release
   */
  async getPoolsAwaitingRelease(): Promise<Pool[]> {
    return this.poolRepository.find({
      where: { status: PoolStatus.AWAITING_RELEASE },
      relations: ["video", "creator"],
      order: { createdAt: "DESC" },
    });
  }
}
