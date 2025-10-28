import { Injectable, Logger } from "@nestjs/common";
import { Pool } from "../../entities/pool.entity";

@Injectable()
export class OddsService {
  private readonly logger = new Logger(OddsService.name);

  /**
   * Calculate dynamic odds based on current stakes
   */
  calculateDynamicOdds(
    yesStake: number,
    noStake: number,
    totalStake: number
  ): { yes: number; no: number } {
    if (totalStake === 0) {
      return { yes: 0.5, no: 0.5 };
    }

    // House edge: 6% total (5% platform + 1% creator)
    const houseEdge = 0.94;
    const netPool = totalStake * houseEdge;

    const yesOdds = yesStake > 0 ? netPool / yesStake - 1 : 0;
    const noOdds = noStake > 0 ? netPool / noStake - 1 : 0;

    return {
      yes: Math.max(0.1, Number(yesOdds.toFixed(2))),
      no: Math.max(0.1, Number(noOdds.toFixed(2))),
    };
  }

  /**
   * Calculate odds for a pool
   */
  calculatePoolOdds(pool: Pool): { yes: number; no: number } {
    return this.calculateDynamicOdds(
      Number(pool.yesStake),
      Number(pool.noStake),
      Number(pool.totalStake)
    );
  }

  /**
   * Calculate potential payout for a prediction
   */
  calculatePotentialPayout(stake: number, odds: number): number {
    return stake * (1 + odds);
  }

  /**
   * Validate if a payout is within limits
   */
  validatePayout(stake: number, odds: number, totalPool: number): boolean {
    const potentialPayout = this.calculatePotentialPayout(stake, odds);
    const maxPossiblePayout = totalPool * 0.94; // After house edge
    return potentialPayout <= maxPossiblePayout;
  }

  /**
   * Calculate odds based on video performance metrics
   */
  calculatePerformanceBasedOdds(
    currentViews: number,
    targetViews: number,
    timeElapsed: number, // in hours
    totalTrackingTime: number // in hours
  ): { yes: number; no: number } {
    const progressRatio = currentViews / targetViews;
    const timeRatio = timeElapsed / totalTrackingTime;

    // Base odds calculation
    let yesOdds = 0.5;
    let noOdds = 0.5;

    // Adjust based on progress
    if (progressRatio >= 1.0) {
      // Already met target
      yesOdds = 0.1;
      noOdds = 0.9;
    } else if (progressRatio >= 0.8) {
      // Very likely to meet target
      yesOdds = 0.2;
      noOdds = 0.8;
    } else if (progressRatio >= 0.6) {
      // Likely to meet target
      yesOdds = 0.3;
      noOdds = 0.7;
    } else if (progressRatio >= 0.4) {
      // Moderate chance
      yesOdds = 0.4;
      noOdds = 0.6;
    } else if (progressRatio >= 0.2) {
      // Unlikely to meet target
      yesOdds = 0.6;
      noOdds = 0.4;
    } else {
      // Very unlikely to meet target
      yesOdds = 0.8;
      noOdds = 0.2;
    }

    // Adjust based on time remaining
    const timeRemainingRatio = 1 - timeRatio;
    if (timeRemainingRatio < 0.2) {
      // Less than 20% time remaining, heavily favor current performance
      const timeAdjustment = 0.3;
      if (progressRatio < 0.5) {
        yesOdds += timeAdjustment;
        noOdds -= timeAdjustment;
      } else {
        yesOdds -= timeAdjustment;
        noOdds += timeAdjustment;
      }
    }

    // Ensure odds are within reasonable bounds
    yesOdds = Math.max(0.1, Math.min(0.9, yesOdds));
    noOdds = Math.max(0.1, Math.min(0.9, noOdds));

    return {
      yes: Number(yesOdds.toFixed(2)),
      no: Number(noOdds.toFixed(2)),
    };
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
   */
  calculateFinalPayouts(
    pool: Pool,
    winningPredictions: any[]
  ): Array<{ predictionId: string; payout: number }> {
    const totalWinningStake = winningPredictions.reduce(
      (sum, pred) => sum + Number(pred.stake),
      0
    );

    const losingStake = Number(pool.totalStake) - totalWinningStake;
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

  /**
   * Get odds explanation for frontend display
   */
  getOddsExplanation(odds: { yes: number; no: number }): {
    yesExplanation: string;
    noExplanation: string;
  } {
    const yesPayout = 1 + odds.yes;
    const noPayout = 1 + odds.no;

    return {
      yesExplanation: `If you bet $1 on YES and win, you'll get $${yesPayout.toFixed(2)} back`,
      noExplanation: `If you bet $1 on NO and win, you'll get $${noPayout.toFixed(2)} back`,
    };
  }
}
