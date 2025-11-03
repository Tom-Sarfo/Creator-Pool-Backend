import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  Prediction,
  PredictionChoice,
  PredictionResult,
} from "../entities/prediction.entity";
import { Pool, PoolStatus } from "../entities/pool.entity";
import { User } from "../entities/user.entity";
import { ProbabilityService } from "../pools/services/probability.service";

export interface CreatePredictionDto {
  poolId: string;
  choice: PredictionChoice;
  stake: number;
}

export interface PredictionFilters {
  poolId?: string;
  predictorId?: string;
  result?: PredictionResult;
  page?: number;
  limit?: number;
}

@Injectable()
export class PredictionService {
  private readonly logger = new Logger(PredictionService.name);

  constructor(
    @InjectRepository(Prediction)
    private predictionRepository: Repository<Prediction>,
    @InjectRepository(Pool)
    private poolRepository: Repository<Pool>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(ProbabilityService)
    private probabilityService: ProbabilityService
  ) {}

  /**
   * Create a new prediction
   */
  async createPrediction(
    predictorId: string,
    createPredictionDto: CreatePredictionDto
  ): Promise<{
    prediction: Prediction;
    potentialPayout: number;
    updatedProbabilities: { probabilityYes: number; probabilityNo: number };
  }> {
    // Validate predictor exists
    const predictor = await this.userRepository.findOne({
      where: { id: predictorId },
    });
    if (!predictor) {
      throw new NotFoundException("Predictor not found");
    }

    // Validate pool exists and is open for predictions
    const pool = await this.poolRepository.findOne({
      where: { id: createPredictionDto.poolId },
    });
    if (!pool) {
      throw new NotFoundException("Pool not found");
    }

    if (!pool.isPredictionWindowOpen()) {
      throw new BadRequestException("Pool prediction window is closed");
    }

    // Check if user already has a prediction in this pool
    const existingPrediction = await this.predictionRepository.findOne({
      where: {
        poolId: createPredictionDto.poolId,
        predictorId,
      },
    });
    if (existingPrediction) {
      throw new ConflictException("User already has a prediction in this pool");
    }

    // Validate stake amount
    if (createPredictionDto.stake <= 0) {
      throw new BadRequestException("Stake must be greater than 0");
    }

    // Convert wallet balance to number since it's stored as decimal (string)
    const walletBalance = Number(predictor.walletBalance);

    this.logger.debug(
      `Wallet balance check - Predictor ID: ${predictorId}, Balance: ${walletBalance}, Stake: ${createPredictionDto.stake}`
    );

    if (createPredictionDto.stake > walletBalance) {
      this.logger.warn(
        `Insufficient balance - Wallet: ${walletBalance}, Stake: ${createPredictionDto.stake}`
      );
      throw new BadRequestException("Insufficient wallet balance");
    }

    // Create prediction
    const prediction = this.predictionRepository.create({
      ...createPredictionDto,
      predictorId,
      predictedAt: new Date(),
    });

    // Calculate potential payout before adding this prediction to pool
    const totalStakeOnUserSide =
      createPredictionDto.choice === PredictionChoice.YES
        ? Number(pool.yesStake)
        : Number(pool.noStake);

    // Calculate potential payout using new formula
    const potentialPayout = this.probabilityService.calculatePotentialPayout(
      createPredictionDto.stake,
      totalStakeOnUserSide,
      Number(pool.totalStake)
    );

    prediction.potentialPayout = potentialPayout;

    const savedPrediction = await this.predictionRepository.save(prediction);

    // Update pool statistics (this updates stakes and probabilities)
    await this.updatePoolStats(pool, createPredictionDto);

    // Deduct stake from user wallet
    predictor.walletBalance -= createPredictionDto.stake;
    await this.userRepository.save(predictor);

    // Get updated pool with new probabilities
    const updatedPool = await this.poolRepository.findOne({
      where: { id: createPredictionDto.poolId },
    });
    const updatedProbabilities =
      this.probabilityService.calculatePoolProbabilities(updatedPool);

    // Recalculate potential payout with updated pool state
    const updatedTotalStakeOnUserSide =
      createPredictionDto.choice === PredictionChoice.YES
        ? Number(updatedPool.yesStake)
        : Number(updatedPool.noStake);
    const updatedPotentialPayout =
      this.probabilityService.calculatePotentialPayout(
        createPredictionDto.stake,
        updatedTotalStakeOnUserSide,
        Number(updatedPool.totalStake)
      );

    return {
      prediction: savedPrediction,
      potentialPayout: updatedPotentialPayout,
      updatedProbabilities,
    };
  }

  /**
   * Get predictions with optional filters
   */
  async getPredictions(filters: PredictionFilters = {}): Promise<{
    predictions: Prediction[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { poolId, predictorId, result, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const queryBuilder = this.predictionRepository
      .createQueryBuilder("prediction")
      .leftJoinAndSelect("prediction.pool", "pool")
      .leftJoinAndSelect("prediction.predictor", "predictor")
      .leftJoinAndSelect("pool.video", "video")
      .leftJoinAndSelect("pool.creator", "creator");

    if (poolId) {
      queryBuilder.where("prediction.poolId = :poolId", { poolId });
    }

    if (predictorId) {
      queryBuilder.where("prediction.predictorId = :predictorId", {
        predictorId,
      });
    }

    if (result) {
      queryBuilder.andWhere("prediction.result = :result", { result });
    }

    const [predictions, total] = await queryBuilder
      .orderBy("prediction.predictedAt", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      predictions,
      total,
      page,
      limit,
    };
  }

  /**
   * Get a single prediction by ID
   */
  async getPredictionById(id: string): Promise<Prediction> {
    const prediction = await this.predictionRepository.findOne({
      where: { id },
      relations: ["pool", "pool.video", "pool.creator", "predictor"],
    });

    if (!prediction) {
      throw new NotFoundException("Prediction not found");
    }

    return prediction;
  }

  /**
   * Get user predictions
   */
  async getUserPredictions(userId: string): Promise<Prediction[]> {
    return this.predictionRepository.find({
      where: { predictorId: userId },
      relations: ["pool", "pool.video", "pool.creator"],
      order: { predictedAt: "DESC" },
    });
  }

  /**
   * Get pool predictions
   */
  async getPoolPredictions(poolId: string): Promise<Prediction[]> {
    return this.predictionRepository.find({
      where: { poolId },
      relations: ["predictor"],
      order: { predictedAt: "ASC" },
    });
  }

  /**
   * Get user's prediction for a specific pool
   */
  async getUserPoolPrediction(
    userId: string,
    poolId: string
  ): Promise<Prediction | null> {
    return this.predictionRepository.findOne({
      where: {
        predictorId: userId,
        poolId,
      },
      relations: ["pool", "pool.video"],
    });
  }

  /**
   * Update pool statistics after a new prediction
   */
  private async updatePoolStats(
    pool: Pool,
    predictionData: CreatePredictionDto
  ): Promise<void> {
    // Update stake totals
    if (predictionData.choice === PredictionChoice.YES) {
      pool.yesStake = Number(pool.yesStake) + predictionData.stake;
      pool.yesCount += 1;
    } else {
      pool.noStake = Number(pool.noStake) + predictionData.stake;
      pool.noCount += 1;
    }

    pool.totalStake = Number(pool.totalStake) + predictionData.stake;
    pool.participants += 1;

    // Update probabilities
    const probabilities =
      this.probabilityService.calculatePoolProbabilities(pool);
    pool.probabilityYes = probabilities.probabilityYes;
    pool.probabilityNo = probabilities.probabilityNo;

    await this.poolRepository.save(pool);
  }

  /**
   * Get prediction statistics for a user
   */
  async getUserPredictionStats(userId: string): Promise<{
    totalPredictions: number;
    wonPredictions: number;
    lostPredictions: number;
    pendingPredictions: number;
    totalEarnings: number;
    totalStaked: number;
    winRate: number;
  }> {
    const predictions = await this.predictionRepository.find({
      where: { predictorId: userId },
    });

    const totalPredictions = predictions.length;
    const wonPredictions = predictions.filter(
      (p) => p.result === PredictionResult.WON
    ).length;
    const lostPredictions = predictions.filter(
      (p) => p.result === PredictionResult.LOST
    ).length;
    const pendingPredictions = predictions.filter(
      (p) => p.result === PredictionResult.PENDING
    ).length;

    const totalEarnings = predictions
      .filter((p) => p.result === PredictionResult.WON)
      .reduce((sum, p) => sum + Number(p.actualPayout || 0), 0);

    const totalStaked = predictions.reduce(
      (sum, p) => sum + Number(p.stake),
      0
    );

    const winRate =
      totalPredictions > 0 ? (wonPredictions / totalPredictions) * 100 : 0;

    return {
      totalPredictions,
      wonPredictions,
      lostPredictions,
      pendingPredictions,
      totalEarnings,
      totalStaked,
      winRate: Number(winRate.toFixed(2)),
    };
  }

  /**
   * Get prediction leaderboard
   */
  async getPredictionLeaderboard(limit: number = 10): Promise<
    Array<{
      user: User;
      stats: {
        totalPredictions: number;
        wonPredictions: number;
        winRate: number;
        totalEarnings: number;
      };
    }>
  > {
    const predictions = await this.predictionRepository
      .createQueryBuilder("prediction")
      .leftJoinAndSelect("prediction.predictor", "predictor")
      .getMany();

    // Group by user and calculate stats
    const userStatsMap = new Map<
      string,
      {
        user: User;
        totalPredictions: number;
        wonPredictions: number;
        totalEarnings: number;
      }
    >();

    for (const prediction of predictions) {
      const userId = prediction.predictorId;

      if (!userStatsMap.has(userId)) {
        userStatsMap.set(userId, {
          user: prediction.predictor,
          totalPredictions: 0,
          wonPredictions: 0,
          totalEarnings: 0,
        });
      }

      const stats = userStatsMap.get(userId);
      stats.totalPredictions += 1;

      if (prediction.result === PredictionResult.WON) {
        stats.wonPredictions += 1;
        stats.totalEarnings += Number(prediction.actualPayout || 0);
      }
    }

    // Convert to array and sort by earnings
    const leaderboard = Array.from(userStatsMap.values())
      .map((stats) => ({
        user: stats.user,
        stats: {
          ...stats,
          winRate:
            stats.totalPredictions > 0
              ? Number(
                  (
                    (stats.wonPredictions / stats.totalPredictions) *
                    100
                  ).toFixed(2)
                )
              : 0,
        },
      }))
      .sort((a, b) => b.stats.totalEarnings - a.stats.totalEarnings)
      .slice(0, limit);

    return leaderboard;
  }

  /**
   * Cancel a prediction (only for open pools)
   */
  async cancelPrediction(predictionId: string, userId: string): Promise<void> {
    const prediction = await this.predictionRepository.findOne({
      where: { id: predictionId },
      relations: ["pool", "predictor"],
    });

    if (!prediction) {
      throw new NotFoundException("Prediction not found");
    }

    if (prediction.predictorId !== userId) {
      throw new BadRequestException("Cannot cancel another user's prediction");
    }

    if (prediction.pool.status !== PoolStatus.OPEN) {
      throw new BadRequestException("Cannot cancel prediction for closed pool");
    }

    // Refund stake to user
    prediction.predictor.walletBalance += Number(prediction.stake);
    await this.userRepository.save(prediction.predictor);

    // Update pool statistics
    const pool = prediction.pool;
    if (prediction.choice === PredictionChoice.YES) {
      pool.yesStake = Number(pool.yesStake) - Number(prediction.stake);
      pool.yesCount -= 1;
    } else {
      pool.noStake = Number(pool.noStake) - Number(prediction.stake);
      pool.noCount -= 1;
    }

    pool.totalStake = Number(pool.totalStake) - Number(prediction.stake);
    pool.participants -= 1;

    // Update probabilities
    const probabilities =
      this.probabilityService.calculatePoolProbabilities(pool);
    pool.probabilityYes = probabilities.probabilityYes;
    pool.probabilityNo = probabilities.probabilityNo;

    await this.poolRepository.save(pool);

    // Remove prediction
    await this.predictionRepository.remove(prediction);
  }
}
