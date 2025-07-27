// src/strategy/PositionManager.ts - With Trailing Stop Feature
import { CsvBar, Position, StrategyTrade, TradeRecord } from './types';
import { TradeStatistics } from './TradeStatistics';

interface TrailingStopConfig {
  enabled: boolean;
  breakevenTrigger: number;
  trailDistance: number;
}

interface ExtendedPosition extends Position {
  initialStopPrice: number;
  highestProfit: number;
  stopMovedToBreakeven: boolean;
  isTrailing: boolean;
}

export class PositionManager {
  private position: ExtendedPosition | null = null;
  private statistics: TradeStatistics = new TradeStatistics();
  private stopLoss: number;
  private takeProfit: number;
  private contractSize: number;
  private trailingConfig: TrailingStopConfig;

  // ES Mini futures constants
  private readonly TICK_SIZE = 0.25;
  private readonly TICK_VALUE = 12.5; // $12.50 per tick
  private readonly COMMISSION_PER_CONTRACT = 2.5; // Round trip commission

  constructor(
    stopLoss: number,
    takeProfit: number,
    contractSize: number,
    useTrailingStop: boolean = false,
    breakevenTrigger: number = 3,
    trailDistance: number = 2
  ) {
    this.stopLoss = stopLoss;
    this.takeProfit = takeProfit;
    this.contractSize = contractSize;
    this.trailingConfig = {
      enabled: useTrailingStop,
      breakevenTrigger,
      trailDistance,
    };
  }

  forceExit(
    bar: CsvBar,
    reason: string
  ): {
    exited: boolean;
    reason?: string;
    profit?: number;
    exitPrice?: number;
    tradeRecord?: TradeRecord;
  } {
    if (!this.position) return { exited: false };

    // Exit at current bar's close price for end-of-day exits
    const exitPrice = bar.close;

    const profitPoints =
      this.position.type === 'bullish'
        ? exitPrice - this.position.entryPrice
        : this.position.entryPrice - exitPrice;

    const totalProfit = this.calculateProfit(profitPoints);
    const tradeRecord = this.createTradeRecord(
      bar,
      exitPrice,
      totalProfit,
      reason
    );
    this.logTrade(bar, reason, exitPrice, totalProfit);
    this.position = null;

    return {
      exited: true,
      reason,
      profit: totalProfit,
      exitPrice,
      tradeRecord,
    };
  }

  hasPosition(): boolean {
    return this.position !== null;
  }

  // In PositionManager.ts - Update the checkExit method with slippage protection

  // In PositionManager.ts - Update the checkExit method with slippage protection

  checkExit(bar: CsvBar): {
    exited: boolean;
    reason?: string;
    profit?: number;
    exitPrice?: number;
    tradeRecord?: TradeRecord;
  } {
    if (!this.position) return { exited: false };

    const { type, stopPrice, targetPrice, entryPrice } = this.position;
    let exitPrice: number | undefined;
    let reason: string | undefined;
    let currentStopPrice = stopPrice;

    // Update trailing stop if enabled
    if (this.trailingConfig.enabled) {
      currentStopPrice = this.updateTrailingStop(bar);
    }

    // MAXIMUM SLIPPAGE PROTECTION
    const MAX_SLIPPAGE_POINTS = 0.25; // Maximum 0.25 points (1 tick) of slippage allowed
    const MAX_SLIPPAGE_PERCENT = 0.0002; // Maximum 0.02% slippage allowed (tightened from 2%)

    if (type === 'bullish') {
      // Check stop loss (including trailing stop)
      if (bar.low <= currentStopPrice) {
        // If bar opened below stop (gap down), check for excessive slippage
        if (bar.open <= currentStopPrice) {
          const slippagePoints = currentStopPrice - bar.open;
          const slippagePercent = slippagePoints / entryPrice;

          // Check if slippage is excessive
          if (
            slippagePoints > MAX_SLIPPAGE_POINTS ||
            slippagePercent > MAX_SLIPPAGE_PERCENT
          ) {
            console.log(
              `⚠️ EXCESSIVE SLIPPAGE DETECTED: ${slippagePoints.toFixed(
                2
              )} points (${(slippagePercent * 100).toFixed(2)}%)`
            );
            console.log(
              `   Entry: ${entryPrice}, Stop: ${currentStopPrice}, Open: ${bar.open}`
            );

            // Exit at maximum allowed slippage
            exitPrice = currentStopPrice - MAX_SLIPPAGE_POINTS;
            reason = 'stop-loss-max-slippage';
          } else {
            exitPrice = bar.open;
            reason = 'stop-loss-gapped';
          }
        } else {
          exitPrice = currentStopPrice;
          reason = this.position.isTrailing
            ? 'trailing-stop'
            : this.position.stopMovedToBreakeven
            ? 'breakeven-stop'
            : 'stop-loss';
        }
      }
      // Check take profit
      else if (bar.high >= targetPrice) {
        if (bar.open >= targetPrice) {
          const slippagePoints = bar.open - targetPrice;
          const slippagePercent = slippagePoints / entryPrice;

          if (
            slippagePoints > MAX_SLIPPAGE_POINTS ||
            slippagePercent > MAX_SLIPPAGE_PERCENT
          ) {
            exitPrice = targetPrice + MAX_SLIPPAGE_POINTS;
            reason = 'take-profit-max-slippage';
          } else {
            exitPrice = bar.open;
            reason = 'take-profit-gapped';
          }
        } else {
          exitPrice = targetPrice;
          reason = 'take-profit';
        }
      }
    } else {
      // bearish position
      // Check stop loss (including trailing stop)
      if (bar.high >= currentStopPrice) {
        // If bar opened above stop (gap up), check for excessive slippage
        if (bar.open >= currentStopPrice) {
          const slippagePoints = bar.open - currentStopPrice;
          const slippagePercent = slippagePoints / entryPrice;

          // Check if slippage is excessive
          if (
            slippagePoints > MAX_SLIPPAGE_POINTS ||
            slippagePercent > MAX_SLIPPAGE_PERCENT
          ) {
            console.log(
              `⚠️ EXCESSIVE SLIPPAGE DETECTED: ${slippagePoints.toFixed(
                2
              )} points (${(slippagePercent * 100).toFixed(2)}%)`
            );
            console.log(
              `   Entry: ${entryPrice}, Stop: ${currentStopPrice}, Open: ${bar.open}`
            );

            // Exit at maximum allowed slippage
            exitPrice = currentStopPrice + MAX_SLIPPAGE_POINTS;
            reason = 'stop-loss-max-slippage';
          } else {
            exitPrice = bar.open;
            reason = 'stop-loss-gapped';
          }
        } else {
          exitPrice = currentStopPrice;
          reason = this.position.isTrailing
            ? 'trailing-stop'
            : this.position.stopMovedToBreakeven
            ? 'breakeven-stop'
            : 'stop-loss';
        }
      }
      // Check take profit
      else if (bar.low <= targetPrice) {
        if (bar.open <= targetPrice) {
          const slippagePoints = targetPrice - bar.open;
          const slippagePercent = slippagePoints / entryPrice;

          if (
            slippagePoints > MAX_SLIPPAGE_POINTS ||
            slippagePercent > MAX_SLIPPAGE_PERCENT
          ) {
            exitPrice = targetPrice - MAX_SLIPPAGE_POINTS;
            reason = 'take-profit-max-slippage';
          } else {
            exitPrice = bar.open;
            reason = 'take-profit-gapped';
          }
        } else {
          exitPrice = targetPrice;
          reason = 'take-profit';
        }
      }
    }

    if (exitPrice !== undefined && reason) {
      const profitPoints =
        type === 'bullish' ? exitPrice - entryPrice : entryPrice - exitPrice;

      const totalProfit = this.calculateProfit(profitPoints);

      // Log if this was a gap situation
      if (reason.includes('gapped') || reason.includes('max-slippage')) {
        console.log(
          `📊 Gap Exit: ${type.toUpperCase()} ` +
            `Entry: ${entryPrice.toFixed(2)} → Exit: ${exitPrice.toFixed(2)} ` +
            `(${Math.abs(profitPoints).toFixed(2)} points) ` +
            `Reason: ${reason}`
        );
      }

      const tradeRecord = this.createTradeRecord(
        bar,
        exitPrice,
        totalProfit,
        reason
      );
      this.logTrade(bar, reason, exitPrice, totalProfit);
      this.position = null;

      return {
        exited: true,
        reason,
        profit: totalProfit,
        exitPrice,
        tradeRecord,
      };
    }

    return { exited: false };
  }
  private updateTrailingStop(bar: CsvBar): number {
    if (!this.position) {
      throw new Error('updateTrailingStop called without an active position');
    }

    const { type, entryPrice, stopPrice } = this.position;
    let currentProfit: number;
    let newStopPrice = stopPrice;

    if (type === 'bullish') {
      currentProfit = bar.high - entryPrice;

      // Update highest profit
      if (currentProfit > this.position.highestProfit) {
        this.position.highestProfit = currentProfit;
      }

      // Move to breakeven
      if (
        !this.position.stopMovedToBreakeven &&
        this.position.highestProfit >= this.trailingConfig.breakevenTrigger
      ) {
        newStopPrice = entryPrice;
        this.position.stopMovedToBreakeven = true;
        this.position.stopPrice = newStopPrice;
        console.log(
          `   → Stop moved to breakeven at ${newStopPrice.toFixed(2)}`
        );
      }

      // Start trailing
      if (
        this.position.stopMovedToBreakeven &&
        this.position.highestProfit >=
          this.trailingConfig.breakevenTrigger +
            this.trailingConfig.trailDistance
      ) {
        const trailStopPrice =
          entryPrice +
          this.position.highestProfit -
          this.trailingConfig.trailDistance;
        if (trailStopPrice > this.position.stopPrice) {
          newStopPrice =
            Math.round(trailStopPrice / this.TICK_SIZE) * this.TICK_SIZE;
          this.position.stopPrice = newStopPrice;
          this.position.isTrailing = true;
          console.log(
            `   → Trailing stop updated to ${newStopPrice.toFixed(2)}`
          );
        }
      }
    } else {
      // bearish position
      currentProfit = entryPrice - bar.low;

      // Update highest profit
      if (currentProfit > this.position.highestProfit) {
        this.position.highestProfit = currentProfit;
      }

      // Move to breakeven
      if (
        !this.position.stopMovedToBreakeven &&
        this.position.highestProfit >= this.trailingConfig.breakevenTrigger
      ) {
        newStopPrice = entryPrice;
        this.position.stopMovedToBreakeven = true;
        this.position.stopPrice = newStopPrice;
        console.log(
          `   → Stop moved to breakeven at ${newStopPrice.toFixed(2)}`
        );
      }

      // Start trailing
      if (
        this.position.stopMovedToBreakeven &&
        this.position.highestProfit >=
          this.trailingConfig.breakevenTrigger +
            this.trailingConfig.trailDistance
      ) {
        const trailStopPrice =
          entryPrice -
          this.position.highestProfit +
          this.trailingConfig.trailDistance;
        if (trailStopPrice < this.position.stopPrice) {
          newStopPrice =
            Math.round(trailStopPrice / this.TICK_SIZE) * this.TICK_SIZE;
          this.position.stopPrice = newStopPrice;
          this.position.isTrailing = true;
          console.log(
            `   → Trailing stop updated to ${newStopPrice.toFixed(2)}`
          );
        }
      }
    }

    return this.position.stopPrice;
  }

  private calculateProfit(profitPoints: number): number {
    // Convert points to ticks
    const ticks = Math.round(profitPoints / this.TICK_SIZE);

    // Calculate gross profit
    const grossProfit = ticks * this.TICK_VALUE * this.contractSize;

    // Subtract commission
    const commission = this.COMMISSION_PER_CONTRACT * this.contractSize;

    return grossProfit - commission;
  }

  private createTradeRecord(
    exitBar: CsvBar,
    exitPrice: number,
    netProfit: number,
    exitReason: string
  ): TradeRecord {
    if (!this.position) throw new Error('No position to create trade record');

    const entryDateTime = new Date(this.position.timestamp);
    const exitDateTime = new Date(exitBar.timestamp);

    // Convert to Eastern Time for display
    const entryDateET = entryDateTime.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
    });
    const entryTimeET = entryDateTime.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const exitDateET = exitDateTime.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
    });
    const exitTimeET = exitDateTime.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const profitPoints =
      this.position.type === 'bullish'
        ? exitPrice - this.position.entryPrice
        : this.position.entryPrice - exitPrice;

    const grossProfit =
      (profitPoints / this.TICK_SIZE) * this.TICK_VALUE * this.contractSize;
    const commission = this.COMMISSION_PER_CONTRACT * this.contractSize;

    // FIX: Use the configured stop/target values, not the calculated distances
    return {
      entryDate: entryDateET,
      entryTime: entryTimeET,
      entryPrice: this.position.entryPrice,
      exitDate: exitDateET,
      exitTime: exitTimeET,
      exitPrice: exitPrice,
      type: this.position.type === 'bullish' ? 'LONG' : 'SHORT',
      contracts: this.contractSize,
      stopLoss: this.stopLoss, // Use the configured value
      takeProfit: this.takeProfit, // Use the configured value
      exitReason: exitReason,
      profitLoss: grossProfit,
      commission: commission,
      netProfitLoss: netProfit,
    };
  }

  private logTrade(
    bar: CsvBar,
    reason: string,
    exitPrice: number,
    totalProfit: number
  ): void {
    if (!this.position) return;

    // Calculate actual points moved for logging
    const actualPointsMoved =
      this.position.type === 'bullish'
        ? exitPrice - this.position.entryPrice
        : this.position.entryPrice - exitPrice;

    // Log detailed trade info for debugging
    console.log(
      `   📊 Trade Details: ${this.position.type.toUpperCase()} ` +
        `Entry: ${this.position.entryPrice.toFixed(
          2
        )} → Exit: ${exitPrice.toFixed(2)} ` +
        `(${actualPointsMoved.toFixed(2)} points) ` +
        `P&L: ${totalProfit.toFixed(2)} ` +
        `Reason: ${reason}`
    );

    const trade: StrategyTrade = {
      type: this.position.type,
      entryPrice: this.position.entryPrice,
      exitPrice: exitPrice,
      profit: totalProfit,
      entryTime: this.position.timestamp,
      exitTime: bar.timestamp,
      reason,
      winLoss: totalProfit > 0 ? 'W' : 'L',
    };
    this.statistics.logTrade(trade);
  }

  enterPosition(
    signal: 'bullish' | 'bearish',
    entryPrice: number,
    bar: CsvBar
  ): ExtendedPosition {
    // Round entry price to nearest tick
    const entry = Math.round(entryPrice / this.TICK_SIZE) * this.TICK_SIZE;

    // Calculate stop and target prices (already in points from parameters)
    const stopPrice =
      signal === 'bullish' ? entry - this.stopLoss : entry + this.stopLoss;
    const targetPrice =
      signal === 'bullish' ? entry + this.takeProfit : entry - this.takeProfit;

    this.position = {
      type: signal,
      entryPrice: entry,
      stopPrice: Math.round(stopPrice / this.TICK_SIZE) * this.TICK_SIZE,
      targetPrice: Math.round(targetPrice / this.TICK_SIZE) * this.TICK_SIZE,
      timestamp: bar.timestamp,
      initialStopPrice: Math.round(stopPrice / this.TICK_SIZE) * this.TICK_SIZE,
      highestProfit: 0,
      stopMovedToBreakeven: false,
      isTrailing: false,
    };

    return this.position;
  }

  getStatistics(): TradeStatistics {
    return this.statistics;
  }

  getContractSize(): number {
    return this.contractSize;
  }

  reset(): void {
    this.position = null;
    this.statistics.reset();
  }
}
