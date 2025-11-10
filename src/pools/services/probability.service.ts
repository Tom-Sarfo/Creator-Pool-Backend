import { Injectable, Logger } from "@nestjs/common";
import { Pool } from "../../entities/pool.entity";
import { Prediction, PredictionChoice } from "../../entities/prediction.entity";

@Injectable()
export class ProbabilityService {
  private readonly logger = new Logger(ProbabilityService.name);

  /**
   * Calculate weight for a stake using sqrt(stake) formula
   */
  calculateWeight(stake: number): number {
    if (stake <= 0) return 0;
    return Math.sqrt(stake);
  }

  /**
   * Calculate weighted probabilities based on predictions
   * Uses sqrt(stake) as weight for each prediction
   */
  calculateProbabilities(
    yesStake: number,
    noStake: number,
    totalStake: number
  ): { probabilityYes: number; probabilityNo: number } {
    if (totalStake === 0) {
      return { probabilityYes: 0.5, probabilityNo: 0.5 };
    }

    // Calculate weights using sqrt(stake)
    const yesWeight = this.calculateWeight(Number(yesStake));
    const noWeight = this.calculateWeight(Number(noStake));
    const totalWeight = yesWeight + noWeight;

    if (totalWeight === 0) {
      return { probabilityYes: 0.5, probabilityNo: 0.5 };
    }

    // Calculate probabilities based on weighted counts
    const probabilityYes = yesWeight / totalWeight;
    const probabilityNo = noWeight / totalWeight;

    return {
      probabilityYes: Number(probabilityYes.toFixed(4)),
      probabilityNo: Number(probabilityNo.toFixed(4)),
    };
  }

  /**
   * Calculate probabilities for a pool based on its current stakes
   */
  calculatePoolProbabilities(pool: Pool): {
    probabilityYes: number;
    probabilityNo: number;
  } {
    return this.calculateProbabilities(
      Number(pool.yesStake),
      Number(pool.noStake),
      Number(pool.totalStake)
    );
  }

  /**
   * Calculate probabilities based on actual predictions
   * This provides more accurate calculation by iterating through predictions
   */
  calculateProbabilitiesFromPredictions(predictions: Prediction[]): {
    probabilityYes: number;
    probabilityNo: number;
  } {
    if (!predictions || predictions.length === 0) {
      return { probabilityYes: 0.5, probabilityNo: 0.5 };
    }

    let totalYesWeight = 0;
    let totalNoWeight = 0;

    for (const prediction of predictions) {
      const weight = this.calculateWeight(Number(prediction.stake));
      if (prediction.choice === PredictionChoice.YES) {
        totalYesWeight += weight;
      } else {
        totalNoWeight += weight;
      }
    }

    const totalWeight = totalYesWeight + totalNoWeight;

    if (totalWeight === 0) {
      return { probabilityYes: 0.5, probabilityNo: 0.5 };
    }

    const probabilityYes = totalYesWeight / totalWeight;
    const probabilityNo = totalNoWeight / totalWeight;

    return {
      probabilityYes: Number(probabilityYes.toFixed(4)),
      probabilityNo: Number(probabilityNo.toFixed(4)),
    };
  }

  /**
   * Calculate potential payout for a user's prediction
   * Formula: (userStake / totalStakeOnUserSide) * totalPool
   * Capped at 80% of net pool (after house edge)
   */
  calculatePotentialPayout(
    userStake: number,
    totalStakeOnUserSide: number,
    totalPool: number
  ): number {
    if (totalStakeOnUserSide === 0 || userStake === 0) {
      return 0;
    }

    // Calculate base payout
    const payout = (userStake / totalStakeOnUserSide) * totalPool;

    // Apply house edge (6% total: 5% platform + 1% creator)
    const netPool = totalPool * 0.94;

    // Cap at 80% of net pool for display fairness
    const cap = netPool * 0.8;

    return Number(Math.min(payout, cap).toFixed(2));
  }

  /**
   * Calculate potential payout for a specific prediction
   */
  calculatePredictionPotentialPayout(
    prediction: Prediction,
    pool: Pool
  ): number {
    const userStake = Number(prediction.stake);
    const totalStakeOnUserSide =
      prediction.choice === PredictionChoice.YES
        ? Number(pool.yesStake)
        : Number(pool.noStake);
    const totalPool = Number(pool.totalStake);

    return this.calculatePotentialPayout(
      userStake,
      totalStakeOnUserSide,
      totalPool
    );
  }

  /**
   * Calculate house edge breakdown
   */
  calculateHouseEdge(totalStake: number): {
    platformFee: number;
    creatorRoyalty: number;
    netPayout: number;
  } {
    const platformFee = totalStake * 0.05; // 5%
    const creatorRoyalty = totalStake * 0.01; // 1%
    const netPayout = totalStake * 0.94; // 94%

    return {
      platformFee: Number(platformFee.toFixed(2)),
      creatorRoyalty: Number(creatorRoyalty.toFixed(2)),
      netPayout: Number(netPayout.toFixed(2)),
    };
  }

  /**
   * Calculate final payouts for winning predictions
   * Based on exact pool ratios at pool closure
   */
  calculateFinalPayouts(
    pool: Pool,
    winningPredictions: Prediction[]
  ): Array<{ predictionId: string; payout: number }> {
    const totalWinningStake = winningPredictions.reduce(
      (sum, pred) => sum + Number(pred.stake),
      0
    );

    if (totalWinningStake === 0) {
      return winningPredictions.map((prediction) => ({
        predictionId: prediction.id,
        payout: 0,
      }));
    }

    // Calculate net payout from losing side (after house edge)
    const losingStake =
      pool.result === "yes_won" ? Number(pool.noStake) : Number(pool.yesStake);
    const houseEdge = this.calculateHouseEdge(losingStake);
    const netPayout = houseEdge.netPayout;

    return winningPredictions.map((prediction) => {
      const share = Number(prediction.stake) / totalWinningStake;
      const payout = netPayout * share;

      return {
        predictionId: prediction.id,
        payout: Number(payout.toFixed(2)),
      };
    });
  }
}




