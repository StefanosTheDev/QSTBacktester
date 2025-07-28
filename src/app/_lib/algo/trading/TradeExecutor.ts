// src/app/_lib/algo/trading/TradeExecutor.ts - FIXED VERSION
import { CsvBar } from '../types/types';
import {
  ExtendedPosition,
  ExitResult,
  FUTURES_CONSTANTS,
} from './PositionTypes';
import { ProfitCalculator } from './ProfitCalculator';
import { StopManager } from './StopManager';

export class TradeExecutor {
  private stopManager: StopManager;
  private profitCalculator: ProfitCalculator;
  private stopLoss: number;
  private takeProfit: number;

  constructor(
    stopManager: StopManager,
    contractSize: number,
    stopLoss: number,
    takeProfit: number
  ) {
    this.stopManager = stopManager;
    this.profitCalculator = new ProfitCalculator(contractSize);
    this.stopLoss = stopLoss;
    this.takeProfit = takeProfit;
  }

  /**
   * Check for exit conditions with STRICT slippage control
   */
  checkExit(position: ExtendedPosition, bar: CsvBar): ExitResult {
    const { type, entryPrice } = position;
    let exitPrice: number | undefined;
    let reason: string | undefined;

    // Update trailing stop if enabled
    const currentStopPrice = this.stopManager.updateTrailingStop(position, bar);

    if (type === 'bullish') {
      const result = this.checkBullishExit(
        bar,
        currentStopPrice,
        position.targetPrice,
        position
      );
      if (result) {
        exitPrice = result.price;
        reason = result.reason;
      }
    } else {
      const result = this.checkBearishExit(
        bar,
        currentStopPrice,
        position.targetPrice,
        position
      );
      if (result) {
        exitPrice = result.price;
        reason = result.reason;
      }
    }

    if (exitPrice !== undefined && reason) {
      // CRITICAL: Validate exit price is realistic
      const maxPoints = Math.max(this.stopLoss, this.takeProfit) + 1; // +1 point buffer
      const maxDeviation = Math.abs(exitPrice - entryPrice);

      if (maxDeviation > maxPoints) {
        console.log(`❌ CRITICAL: Unrealistic exit detected!`);
        console.log(
          `   Entry: ${entryPrice}, Exit: ${exitPrice}, Deviation: ${maxDeviation.toFixed(
            2
          )} points`
        );
        console.log(`   Max allowed: ${maxPoints} points`);

        // Force exit to maximum allowed
        if (reason.includes('stop')) {
          exitPrice =
            type === 'bullish'
              ? entryPrice - this.stopLoss - FUTURES_CONSTANTS.TICK_SIZE
              : entryPrice + this.stopLoss + FUTURES_CONSTANTS.TICK_SIZE;
        } else {
          exitPrice =
            type === 'bullish'
              ? entryPrice + this.takeProfit + FUTURES_CONSTANTS.TICK_SIZE
              : entryPrice - this.takeProfit - FUTURES_CONSTANTS.TICK_SIZE;
        }
        reason = reason + '-capped';
      }

      return this.executeExit(position, bar, exitPrice, reason);
    }

    return { exited: false };
  }

  /**
   * Force exit at current bar close
   */
  forceExit(
    position: ExtendedPosition,
    bar: CsvBar,
    reason: string
  ): ExitResult {
    const exitPrice = bar.close;
    return this.executeExit(position, bar, exitPrice, reason);
  }

  private checkBullishExit(
    bar: CsvBar,
    stopPrice: number,
    targetPrice: number,
    position: ExtendedPosition
  ): { price: number; reason: string } | undefined {
    // Check stop loss
    if (bar.low <= stopPrice) {
      const { price, reason } = this.calculateStrictExitPrice(
        bar,
        stopPrice,
        'stop',
        'bullish'
      );
      return {
        price,
        reason: reason || this.stopManager.getStopType(position),
      };
    }

    // Check take profit
    if (bar.high >= targetPrice) {
      const { price, reason } = this.calculateStrictExitPrice(
        bar,
        targetPrice,
        'target',
        'bullish'
      );
      return { price, reason: reason || 'take-profit' };
    }

    return undefined;
  }

  private checkBearishExit(
    bar: CsvBar,
    stopPrice: number,
    targetPrice: number,
    position: ExtendedPosition
  ): { price: number; reason: string } | undefined {
    // Check stop loss
    if (bar.high >= stopPrice) {
      const { price, reason } = this.calculateStrictExitPrice(
        bar,
        stopPrice,
        'stop',
        'bearish'
      );
      return {
        price,
        reason: reason || this.stopManager.getStopType(position),
      };
    }

    // Check take profit
    if (bar.low <= targetPrice) {
      const { price, reason } = this.calculateStrictExitPrice(
        bar,
        targetPrice,
        'target',
        'bearish'
      );
      return { price, reason: reason || 'take-profit' };
    }

    return undefined;
  }

  private calculateStrictExitPrice(
    bar: CsvBar,
    expectedPrice: number,
    exitType: 'stop' | 'target',
    positionType: 'bullish' | 'bearish'
  ): { price: number; reason?: string } {
    let exitPrice = expectedPrice;
    let reason: string | undefined;

    // Check if bar gapped past our exit
    const isGapped = this.isBarGapped(
      bar,
      expectedPrice,
      exitType,
      positionType
    );

    if (isGapped) {
      // STRICT SLIPPAGE CONTROL - Maximum 1 tick (0.25 points)
      const gapAmount =
        exitType === 'stop'
          ? positionType === 'bullish'
            ? expectedPrice - bar.open
            : bar.open - expectedPrice
          : positionType === 'bullish'
          ? bar.open - expectedPrice
          : expectedPrice - bar.open;

      if (gapAmount > 0) {
        // We have a gap - limit slippage to 1 tick maximum
        const maxSlippage =
          FUTURES_CONSTANTS.MAX_SLIPPAGE_TICKS * FUTURES_CONSTANTS.TICK_SIZE;

        if (gapAmount > maxSlippage) {
          // Cap the slippage
          if (exitType === 'stop') {
            exitPrice =
              positionType === 'bullish'
                ? expectedPrice - maxSlippage
                : expectedPrice + maxSlippage;
            reason = 'stop-loss-max-slippage';
            console.log(
              `⚠️ SLIPPAGE CAPPED: Gap of ${gapAmount.toFixed(
                2
              )} points limited to ${maxSlippage} points`
            );
          } else {
            exitPrice =
              positionType === 'bullish'
                ? expectedPrice + maxSlippage
                : expectedPrice - maxSlippage;
            reason = 'take-profit-max-slippage';
          }
        } else {
          // Small gap - use actual open price
          exitPrice = bar.open;
          reason =
            exitType === 'stop' ? 'stop-loss-gapped' : 'take-profit-gapped';
        }
      }
    }

    // Ensure price is rounded to tick
    return {
      price: ProfitCalculator.roundToTick(exitPrice),
      reason,
    };
  }

  private isBarGapped(
    bar: CsvBar,
    price: number,
    exitType: 'stop' | 'target',
    positionType: 'bullish' | 'bearish'
  ): boolean {
    if (positionType === 'bullish') {
      return exitType === 'stop' ? bar.open < price : bar.open > price;
    } else {
      return exitType === 'stop' ? bar.open > price : bar.open < price;
    }
  }

  private executeExit(
    position: ExtendedPosition,
    bar: CsvBar,
    exitPrice: number,
    reason: string
  ): ExitResult {
    const profitPoints =
      position.type === 'bullish'
        ? exitPrice - position.entryPrice
        : position.entryPrice - exitPrice;

    const totalProfit = this.profitCalculator.calculateProfit(profitPoints);

    // STRICT P&L VALIDATION
    const validation = this.profitCalculator.validatePL(
      totalProfit,
      this.stopLoss,
      this.takeProfit
    );

    if (!validation.valid) {
      console.log(`❌ ${validation.message}`);
      console.log(
        `   Entry: ${position.entryPrice}, Exit: ${exitPrice}, Type: ${position.type}, Reason: ${reason}`
      );
      console.log(`   Points moved: ${Math.abs(profitPoints).toFixed(2)}`);

      // Log the calculation
      const ticks = Math.round(profitPoints / FUTURES_CONSTANTS.TICK_SIZE);
      const contracts = this.profitCalculator['contractSize'];
      const commission = FUTURES_CONSTANTS.COMMISSION_PER_CONTRACT * contracts;
      console.log(
        `   Calculation: ${ticks} ticks × $12.50 × ${contracts} contracts - $${commission} = $${totalProfit.toFixed(
          2
        )}`
      );
    }

    return {
      exited: true,
      reason,
      profit: totalProfit,
      exitPrice,
    };
  }
}
