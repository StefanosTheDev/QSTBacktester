// src/strategy/PositionManager.ts
import { CsvBar, Position, StrategyTrade, TradeRecord } from './types';
import { TradeStatistics } from './TradeStatistics';

export class PositionManager {
  private position: Position | null = null;
  private statistics: TradeStatistics = new TradeStatistics();
  private stopLoss: number;
  private takeProfit: number;
  private contractSize: number;

  // ES Mini futures constants
  private readonly TICK_SIZE = 0.25;
  private readonly TICK_VALUE = 12.5; // $12.50 per tick
  private readonly COMMISSION_PER_CONTRACT = 2.5; // Round trip commission
  // REMOVED SLIPPAGE - NO MORE EXTRA TICKS

  constructor(stopLoss: number, takeProfit: number, contractSize: number) {
    this.stopLoss = stopLoss;
    this.takeProfit = takeProfit;
    this.contractSize = contractSize;
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

    if (type === 'bullish') {
      // Check stop loss
      if (bar.low <= stopPrice) {
        // If bar opened below stop (gap down), exit at open
        // Otherwise exit at stop price exactly
        if (bar.open <= stopPrice) {
          exitPrice = bar.open;
        } else {
          exitPrice = stopPrice; // No slippage
        }
        reason = 'stop-loss';
      }
      // Check take profit
      else if (bar.high >= targetPrice) {
        // If bar opened above target (gap up), exit at open
        // Otherwise exit at target price
        if (bar.open >= targetPrice) {
          exitPrice = bar.open;
        } else {
          exitPrice = targetPrice;
        }
        reason = 'take-profit';
      }
    } else {
      // bearish position
      // Check stop loss
      if (bar.high >= stopPrice) {
        // If bar opened above stop (gap up), exit at open
        // Otherwise exit at stop price exactly
        if (bar.open >= stopPrice) {
          exitPrice = bar.open;
        } else {
          exitPrice = stopPrice; // No slippage
        }
        reason = 'stop-loss';
      }
      // Check take profit
      else if (bar.low <= targetPrice) {
        // If bar opened below target (gap down), exit at open
        // Otherwise exit at target price
        if (bar.open <= targetPrice) {
          exitPrice = bar.open;
        } else {
          exitPrice = targetPrice;
        }
        reason = 'take-profit';
      }
    }

    if (exitPrice !== undefined && reason) {
      const profitPoints =
        type === 'bullish' ? exitPrice - entryPrice : entryPrice - exitPrice;

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

    return { exited: false };
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

    return {
      entryDate: entryDateET,
      entryTime: entryTimeET,
      entryPrice: this.position.entryPrice,
      exitDate: exitDateET,
      exitTime: exitTimeET,
      exitPrice: exitPrice,
      type: this.position.type === 'bullish' ? 'LONG' : 'SHORT',
      contracts: this.contractSize,
      stopLoss: Math.abs(this.position.stopPrice - this.position.entryPrice),
      takeProfit: Math.abs(
        this.position.targetPrice - this.position.entryPrice
      ),
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
  ): Position {
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
