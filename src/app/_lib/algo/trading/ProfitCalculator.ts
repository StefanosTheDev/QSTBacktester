// src/app/_lib/algo/trading/ProfitCalculator.ts - FIXED VERSION
import { FUTURES_CONSTANTS } from './PositionTypes';

export class ProfitCalculator {
  private contractSize: number;

  constructor(contractSize: number) {
    this.contractSize = contractSize;
  }

  /**
   * Calculate profit/loss for a trade
   */
  calculateProfit(profitPoints: number): number {
    // Convert points to ticks
    const ticks = Math.round(profitPoints / FUTURES_CONSTANTS.TICK_SIZE);

    // Calculate gross profit
    const grossProfit =
      ticks * FUTURES_CONSTANTS.TICK_VALUE * this.contractSize;

    // Subtract commission
    const commission =
      FUTURES_CONSTANTS.COMMISSION_PER_CONTRACT * this.contractSize;

    return grossProfit - commission;
  }

  /**
   * Calculate expected P&L for validation
   */
  getExpectedPL(points: number, isWin: boolean): number {
    const ticks = points / FUTURES_CONSTANTS.TICK_SIZE;
    const grossPL = ticks * FUTURES_CONSTANTS.TICK_VALUE * this.contractSize;
    const commission =
      FUTURES_CONSTANTS.COMMISSION_PER_CONTRACT * this.contractSize;

    return isWin ? grossPL - commission : -(grossPL + commission);
  }

  /**
   * STRICT validation of P&L
   */
  validatePL(
    actualPL: number,
    stopLoss: number,
    takeProfit: number
  ): { valid: boolean; message?: string } {
    // Calculate expected values
    const expectedWin = this.getExpectedPL(takeProfit, true);
    const expectedLoss = this.getExpectedPL(stopLoss, false);

    // STRICT TOLERANCE - Only allow 1 tick of slippage worth of P&L difference
    const slippageTolerance = FUTURES_CONSTANTS.TICK_VALUE * this.contractSize; // $12.50 per contract

    // Check if it's a win or loss
    const isWin = actualPL > 0;
    const expectedPL = isWin ? expectedWin : expectedLoss;
    const deviation = Math.abs(actualPL - expectedPL);

    // Strict validation
    if (deviation > slippageTolerance) {
      return {
        valid: false,
        message: `Unrealistic P&L: $${actualPL.toFixed(
          2
        )} (expected: $${expectedPL.toFixed(
          2
        )}, deviation: $${deviation.toFixed(2)})`,
      };
    }

    // Also check absolute limits - no trade should exceed these
    const maxPossibleWin = this.getExpectedPL(takeProfit + 1, true); // +1 point for extreme slippage
    const maxPossibleLoss = this.getExpectedPL(stopLoss + 1, false); // +1 point for extreme slippage

    if (actualPL > maxPossibleWin || actualPL < maxPossibleLoss) {
      return {
        valid: false,
        message: `P&L exceeds maximum possible: $${actualPL.toFixed(
          2
        )} (max win: $${maxPossibleWin.toFixed(
          2
        )}, max loss: $${maxPossibleLoss.toFixed(2)})`,
      };
    }

    return { valid: true };
  }

  /**
   * Round price to nearest tick
   */
  static roundToTick(price: number): number {
    return (
      Math.round(price / FUTURES_CONSTANTS.TICK_SIZE) *
      FUTURES_CONSTANTS.TICK_SIZE
    );
  }

  /**
   * Calculate slippage in ticks
   */
  static calculateSlippageTicks(
    expectedPrice: number,
    actualPrice: number
  ): number {
    return Math.round(
      Math.abs(actualPrice - expectedPrice) / FUTURES_CONSTANTS.TICK_SIZE
    );
  }

  /**
   * Get expected P&L values for logging
   */
  getExpectedPLValues(
    stopLoss: number,
    takeProfit: number
  ): {
    expectedWin: number;
    expectedLoss: number;
    maxWin: number;
    maxLoss: number;
  } {
    return {
      expectedWin: this.getExpectedPL(takeProfit, true),
      expectedLoss: this.getExpectedPL(stopLoss, false),
      maxWin: this.getExpectedPL(takeProfit + 1, true), // With 1 point slippage
      maxLoss: this.getExpectedPL(stopLoss + 1, false), // With 1 point slippage
    };
  }
}
