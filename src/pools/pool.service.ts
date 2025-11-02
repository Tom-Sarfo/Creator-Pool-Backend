import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Pool, PoolStatus, PoolResult } from "../entities/pool.entity";
import { Video, VideoStatus } from "../entities/video.entity";
import { User } from "../entities/user.entity";
import { PoolLifecycleService } from "./services/pool-lifecycle.service";
import { OddsService } from "./services/odds.service";

export interface CreatePoolDto {
  videoId: string;
  question: string;
  targetViews: number;
  predictionWindowMinutes?: number;
  trackingDurationDays?: number;
  creatorPledge?: number;
}

export interface UpdatePoolDto {
  question?: string;
  targetViews?: number;
  trackingDurationDays?: number;
  creatorPledge?: number;
}

export interface DepositPledgeDto {
  amount: number;
}

export interface PoolFilters {
  status?: PoolStatus;
  creatorId?: string;
  videoId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class PoolService {
  constructor(
    @InjectRepository(Pool)
    private poolRepository: Repository<Pool>,
    @InjectRepository(Video)
    private videoRepository: Repository<Video>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(PoolLifecycleService)
    private poolLifecycleService: PoolLifecycleService,
    @Inject(OddsService)
    private oddsService: OddsService
  ) {}

  /**
   * Create a new pool
   */
  async createPool(
    creatorId: string,
    createPoolDto: CreatePoolDto
  ): Promise<Pool> {
    // Validate creator exists
    const creator = await this.userRepository.findOne({
      where: { id: creatorId },
    });
    if (!creator) {
      throw new NotFoundException("Creator not found");
    }

    // Validate video exists and is eligible for pool creation
    const video = await this.videoRepository.findOne({
      where: { id: createPoolDto.videoId },
    });
    if (!video) {
      throw new NotFoundException("Video not found");
    }

    if (!video.canCreatePool()) {
      throw new BadRequestException("Video is not eligible for pool creation");
    }

    // Check if video already has an active pool
    const existingPool = await this.poolRepository.findOne({
      where: {
        videoId: createPoolDto.videoId,
        status: PoolStatus.OPEN,
      },
    });
    if (existingPool) {
      throw new ConflictException("Video already has an active pool");
    }

    // Create pool
    const pool = this.poolRepository.create({
      ...createPoolDto,
      creatorId,
      predictionWindowMinutes:
        createPoolDto.predictionWindowMinutes || 15, // 15 minutes in minutes
      trackingDurationDays: createPoolDto.trackingDurationDays || 7,
      creatorPledge: createPoolDto.creatorPledge || 0,
      status: PoolStatus.OPEN,
      closesAt: new Date(
        Date.now() +
          (createPoolDto.predictionWindowMinutes || 15) * 60 * 1000
      ),
    });

    const savedPool = await this.poolRepository.save(pool);

    // Update video to mark it as having an active pool
    video.hasActivePool = true;
    video.poolCreatedAt = new Date();
    await this.videoRepository.save(video);

    return savedPool;
  }

  /**
   * Get pools with optional filters
   */
  async getPools(filters: PoolFilters = {}): Promise<{
    pools: Pool[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { status, creatorId, videoId, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const queryBuilder = this.poolRepository
      .createQueryBuilder("pool")
      .leftJoinAndSelect("pool.video", "video")
      .leftJoinAndSelect("pool.creator", "creator")
      .leftJoinAndSelect("pool.predictions", "predictions");

    if (status) {
      queryBuilder.where("pool.status = :status", { status });
    }

    if (creatorId) {
      queryBuilder.andWhere("pool.creatorId = :creatorId", { creatorId });
    }

    if (videoId) {
      queryBuilder.andWhere("pool.videoId = :videoId", { videoId });
    }

    const [pools, total] = await queryBuilder
      .orderBy("pool.createdAt", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // Calculate odds for each pool
    for (const pool of pools) {
      const odds = this.oddsService.calculatePoolOdds(pool);
      pool.yesOdds = odds.yes;
      pool.noOdds = odds.no;
    }

    return {
      pools,
      total,
      page,
      limit,
    };
  }

  /**
   * Get a single pool by ID
   */
  async getPoolById(id: string): Promise<Pool> {
    const pool = await this.poolRepository.findOne({
      where: { id },
      relations: ["video", "creator", "predictions", "predictions.predictor"],
    });

    if (!pool) {
      throw new NotFoundException("Pool not found");
    }

    // Calculate current odds
    const odds = this.oddsService.calculatePoolOdds(pool);
    pool.yesOdds = odds.yes;
    pool.noOdds = odds.no;

    return pool;
  }

  /**
   * Update a pool
   * If creatorPledge is updated and pool is CLOSED, automatically trigger settlement check
   */
  async updatePool(id: string, updatePoolDto: UpdatePoolDto): Promise<Pool> {
    const pool = await this.getPoolById(id);

    // Only allow updates for open pools (unless updating pledge)
    if (
      pool.status !== PoolStatus.OPEN &&
      !(
        updatePoolDto.creatorPledge !== undefined &&
        pool.status === PoolStatus.CLOSED
      )
    ) {
      throw new BadRequestException(
        "Can only update open pools (or pledge for closed pools)"
      );
    }

    const hadPledgeBefore = Number(pool.creatorPledge) > 0;
    const pledgeUpdated = updatePoolDto.creatorPledge !== undefined;

    Object.assign(pool, updatePoolDto);
    const updatedPool = await this.poolRepository.save(pool);

    // If pledge was updated and pool is CLOSED, check for settlement
    if (
      pledgeUpdated &&
      updatedPool.status === PoolStatus.CLOSED &&
      Number(updatedPool.creatorPledge) > 0 &&
      !hadPledgeBefore
    ) {
      await this.poolLifecycleService.checkAndSettlePoolsWithPledge(id);
      // Return updated pool after settlement
      return this.getPoolById(id);
    }

    return updatedPool;
  }

  /**
   * Delete a pool
   */
  async deletePool(id: string): Promise<void> {
    const pool = await this.getPoolById(id);

    // Only allow deletion of open pools
    if (pool.status !== PoolStatus.OPEN) {
      throw new BadRequestException("Can only delete open pools");
    }

    // Update video to remove active pool status
    const video = await this.videoRepository.findOne({
      where: { id: pool.videoId },
    });
    if (video) {
      video.hasActivePool = false;
      video.poolClosedAt = new Date();
      await this.videoRepository.save(video);
    }

    await this.poolRepository.remove(pool);
  }

  /**
   * Get active pools (open or live tracking)
   */
  async getActivePools(): Promise<Pool[]> {
    return this.poolLifecycleService.getActivePools();
  }

  /**
   * Get pools by status
   */
  async getPoolsByStatus(status: PoolStatus): Promise<Pool[]> {
    return this.poolLifecycleService.getPoolsByStatus(status);
  }

  /**
   * Get creator pools
   */
  async getCreatorPools(creatorId: string): Promise<Pool[]> {
    return this.poolLifecycleService.getCreatorPools(creatorId);
  }

  /**
   * Get pools awaiting release
   */
  async getPoolsAwaitingRelease(): Promise<Pool[]> {
    return this.poolLifecycleService.getPoolsAwaitingRelease();
  }

  /**
   * Close pool prediction window manually
   */
  async closePredictionWindow(id: string): Promise<Pool> {
    const pool = await this.getPoolById(id);

    if (pool.status !== PoolStatus.OPEN) {
      throw new BadRequestException("Pool is not open");
    }

    await this.poolLifecycleService.closePredictionWindow(pool);
    return this.getPoolById(id);
  }

  /**
   * Start live tracking manually
   */
  async startLiveTracking(id: string): Promise<Pool> {
    const pool = await this.getPoolById(id);

    if (pool.status !== PoolStatus.AWAITING_RELEASE) {
      throw new BadRequestException("Pool is not awaiting release");
    }

    await this.poolLifecycleService.startLiveTracking(pool);
    return this.getPoolById(id);
  }

  /**
   * Close tracking period manually
   */
  async closeTrackingPeriod(id: string): Promise<Pool> {
    const pool = await this.getPoolById(id);

    if (pool.status !== PoolStatus.LIVE_TRACKING) {
      throw new BadRequestException("Pool is not live tracking");
    }

    await this.poolLifecycleService.closeTrackingPeriod(pool);
    return this.getPoolById(id);
  }

  /**
   * Settle pool manually
   */
  async settlePool(id: string): Promise<Pool> {
    const pool = await this.getPoolById(id);

    if (pool.status !== PoolStatus.CLOSED) {
      throw new BadRequestException("Pool is not closed");
    }

    await this.poolLifecycleService.settlePool(pool);
    return this.getPoolById(id);
  }

  /**
   * Get pool statistics
   */
  async getPoolStats(id: string): Promise<{
    totalPredictions: number;
    yesPredictions: number;
    noPredictions: number;
    totalStake: number;
    yesStake: number;
    noStake: number;
    participants: number;
    currentOdds: { yes: number; no: number };
    timeRemaining: number;
  }> {
    const pool = await this.getPoolById(id);

    const odds = this.oddsService.calculatePoolOdds(pool);
    const timeRemaining = pool.isPredictionWindowOpen()
      ? pool.getPredictionTimeRemaining()
      : pool.getTrackingTimeRemaining();

    return {
      totalPredictions: pool.predictions?.length || 0,
      yesPredictions: pool.yesCount,
      noPredictions: pool.noCount,
      totalStake: Number(pool.totalStake),
      yesStake: Number(pool.yesStake),
      noStake: Number(pool.noStake),
      participants: pool.participants,
      currentOdds: odds,
      timeRemaining,
    };
  }

  /**
   * Get trending pools
   */
  async getTrendingPools(limit: number = 10): Promise<Pool[]> {
    return this.poolRepository.find({
      where: [
        { status: PoolStatus.OPEN },
        { status: PoolStatus.LIVE_TRACKING },
      ],
      relations: ["video", "creator"],
      order: {
        participants: "DESC",
        totalStake: "DESC",
        createdAt: "DESC",
      },
      take: limit,
    });
  }

  /**
   * Search pools by question
   */
  async searchPools(query: string, limit: number = 20): Promise<Pool[]> {
    return this.poolRepository
      .createQueryBuilder("pool")
      .leftJoinAndSelect("pool.video", "video")
      .leftJoinAndSelect("pool.creator", "creator")
      .where("pool.question ILIKE :query", { query: `%${query}%` })
      .andWhere("pool.status IN (:...statuses)", {
        statuses: [PoolStatus.OPEN, PoolStatus.LIVE_TRACKING],
      })
      .orderBy("pool.createdAt", "DESC")
      .limit(limit)
      .getMany();
  }

  /**
   * Deposit pledge for a pool
   * If pool is CLOSED, automatically trigger settlement check
   */
  async depositPledge(
    poolId: string,
    amount: number,
    creatorId: string
  ): Promise<Pool> {
    const pool = await this.getPoolById(poolId);

    // Verify creator owns this pool
    if (pool.creatorId !== creatorId) {
      throw new BadRequestException("Only the pool creator can deposit pledge");
    }

    // Only allow pledge deposits for OPEN, AWAITING_RELEASE, LIVE_TRACKING, or CLOSED pools
    if (pool.status === PoolStatus.SETTLED) {
      throw new BadRequestException("Cannot deposit pledge for settled pools");
    }

    // Update pledge amount (add to existing if any)
    const currentPledge = Number(pool.creatorPledge) || 0;
    pool.creatorPledge = currentPledge + amount;

    const updatedPool = await this.poolRepository.save(pool);

    // If pool is CLOSED, check if it should be settled now
    if (pool.status === PoolStatus.CLOSED && Number(pool.creatorPledge) > 0) {
      await this.poolLifecycleService.checkAndSettlePoolsWithPledge(poolId);
      // Return updated pool after settlement
      return this.getPoolById(poolId);
    }

    return updatedPool;
  }
}
