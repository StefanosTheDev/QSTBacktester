// src/strategy/trading/StopManager.ts
import { ExtendedPosition, TrailingStopConfig } from './PositionTypes';
import { CsvBar } from '../types/types';
import { ProfitCalculator } from './ProfitCalculator';

export class StopManager {
  private trailingConfig: TrailingStopConfig;

  constructor(trailingConfig: TrailingStopConfig) {
    this.trailingConfig = trailingConfig;
  }

  /**
   * Update trailing stop if conditions are met
   */
  updateTrailingStop(position: ExtendedPosition, bar: CsvBar): number {
    if (!this.trailingConfig.enabled) {
      return position.stopPrice;
    }

    const { type, entryPrice } = position;
    let currentProfit: number;
    let newStopPrice = position.stopPrice;

    if (type === 'bullish') {
      currentProfit = bar.high - entryPrice;

      // Update highest profit
      if (currentProfit > position.highestProfit) {
        position.highestProfit = currentProfit;
      }

      // Move to breakeven
      if (
        !position.stopMovedToBreakeven &&
        position.highestProfit >= this.trailingConfig.breakevenTrigger
      ) {
        newStopPrice = entryPrice;
        position.stopMovedToBreakeven = true;
        position.stopPrice = newStopPrice;
        console.log(
          `   → Stop moved to breakeven at ${newStopPrice.toFixed(2)}`
        );
      }

      // Start trailing
      if (
        position.stopMovedToBreakeven &&
        position.highestProfit >=
          this.trailingConfig.breakevenTrigger +
            this.trailingConfig.trailDistance
      ) {
        const trailStopPrice =
          entryPrice +
          position.highestProfit -
          this.trailingConfig.trailDistance;
        if (trailStopPrice > position.stopPrice) {
          newStopPrice = ProfitCalculator.roundToTick(trailStopPrice);
          position.stopPrice = newStopPrice;
          position.isTrailing = true;
          console.log(
            `   → Trailing stop updated to ${newStopPrice.toFixed(2)}`
          );
        }
      }
    } else {
      // Bearish position
      currentProfit = entryPrice - bar.low;

      if (currentProfit > position.highestProfit) {
        position.highestProfit = currentProfit;
      }

      if (
        !position.stopMovedToBreakeven &&
        position.highestProfit >= this.trailingConfig.breakevenTrigger
      ) {
        newStopPrice = entryPrice;
        position.stopMovedToBreakeven = true;
        position.stopPrice = newStopPrice;
        console.log(
          `   → Stop moved to breakeven at ${newStopPrice.toFixed(2)}`
        );
      }

      if (
        position.stopMovedToBreakeven &&
        position.highestProfit >=
          this.trailingConfig.breakevenTrigger +
            this.trailingConfig.trailDistance
      ) {
        const trailStopPrice =
          entryPrice -
          position.highestProfit +
          this.trailingConfig.trailDistance;
        if (trailStopPrice < position.stopPrice) {
          newStopPrice = ProfitCalculator.roundToTick(trailStopPrice);
          position.stopPrice = newStopPrice;
          position.isTrailing = true;
          console.log(
            `   → Trailing stop updated to ${newStopPrice.toFixed(2)}`
          );
        }
      }
    }

    return position.stopPrice;
  }

  /**
   * Determine stop type for exit reason
   */
  getStopType(position: ExtendedPosition): string {
    if (position.isTrailing) return 'trailing-stop';
    if (position.stopMovedToBreakeven) return 'breakeven-stop';
    return 'stop-loss';
  }
}
