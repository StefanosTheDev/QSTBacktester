// src/app/_lib/algo/core/PositionManager.ts - FINAL FIXED VERSION
import { CsvBar, StrategyTrade } from '../types/types';
import {
  ExtendedPosition,
  ExitResult,
  TradeRecord,
  TrailingStopConfig,
  FUTURES_CONSTANTS,
} from '../trading/PositionTypes';
import { TradeStatistics } from './TradeStatistics';
import { ProfitCalculator } from '../trading/ProfitCalculator';
import { StopManager } from '../trading/StopManager';
import { TradeExecutor } from '../trading/TradeExecutor';
import { DateTimeUtils } from '../utils/DateTimeUtils';

export class PositionManager {
  private position: ExtendedPosition | null = null;
  private statistics: TradeStatistics = new TradeStatistics();
  private stopLoss: number;
  private takeProfit: number;
  private contractSize: number;

  private profitCalculator: ProfitCalculator;
  private stopManager: StopManager;
  private tradeExecutor: TradeExecutor;

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

    const trailingConfig: TrailingStopConfig = {
      enabled: useTrailingStop,
      breakevenTrigger,
      trailDistance,
    };

    this.profitCalculator = new ProfitCalculator(contractSize);
    this.stopManager = new StopManager(trailingConfig);
    this.tradeExecutor = new TradeExecutor(
      this.stopManager,
      contractSize,
      stopLoss,
      takeProfit
    );
  }

  hasPosition(): boolean {
    return this.position !== null;
  }

  enterPosition(
    signal: 'bullish' | 'bearish',
    entryPrice: number,
    bar: CsvBar
  ): ExtendedPosition {
    // Round entry price to nearest tick
    const entry = ProfitCalculator.roundToTick(entryPrice);

    // Calculate stop and target prices
    const stopPrice =
      signal === 'bullish' ? entry - this.stopLoss : entry + this.stopLoss;
    const targetPrice =
      signal === 'bullish' ? entry + this.takeProfit : entry - this.takeProfit;

    this.position = {
      type: signal,
      entryPrice: entry,
      stopPrice: ProfitCalculator.roundToTick(stopPrice),
      targetPrice: ProfitCalculator.roundToTick(targetPrice),
      timestamp: bar.timestamp,
      initialStopPrice: ProfitCalculator.roundToTick(stopPrice),
      highestProfit: 0,
      stopMovedToBreakeven: false,
      isTrailing: false,
    };

    // Log expected P&L for this position
    const expectedValues = this.profitCalculator.getExpectedPLValues(
      this.stopLoss,
      this.takeProfit
    );
    console.log(`📊 Position entered - Expected P&L:`);
    console.log(
      `   Win: $${expectedValues.expectedWin.toFixed(
        2
      )} (max: $${expectedValues.maxWin.toFixed(2)})`
    );
    console.log(
      `   Loss: $${expectedValues.expectedLoss.toFixed(
        2
      )} (max: $${expectedValues.maxLoss.toFixed(2)})`
    );

    return this.position;
  }

  checkExit(bar: CsvBar): ExitResult {
    if (!this.position) return { exited: false };

    const result = this.tradeExecutor.checkExit(this.position, bar);

    if (result.exited) {
      const tradeRecord = this.createTradeRecord(
        bar,
        result.exitPrice!,
        result.profit!,
        result.reason!
      );

      this.logTrade(bar, result.reason!, result.exitPrice!, result.profit!);
      this.position = null;

      return { ...result, tradeRecord };
    }

    return result;
  }

  forceExit(bar: CsvBar, reason: string): ExitResult {
    if (!this.position) return { exited: false };

    const result = this.tradeExecutor.forceExit(this.position, bar, reason);

    if (result.exited) {
      const tradeRecord = this.createTradeRecord(
        bar,
        result.exitPrice!,
        result.profit!,
        reason
      );

      this.logTrade(bar, reason, result.exitPrice!, result.profit!);
      this.position = null;

      return { ...result, tradeRecord };
    }

    return result;
  }

  private createTradeRecord(
    exitBar: CsvBar,
    exitPrice: number,
    netProfit: number,
    exitReason: string
  ): TradeRecord {
    if (!this.position) throw new Error('No position to create trade record');

    // Convert PST timestamps to EST for display
    const entryEST = DateTimeUtils.convertPSTtoEST(this.position.timestamp);
    const exitEST = DateTimeUtils.convertPSTtoEST(exitBar.timestamp);

    const profitPoints =
      this.position.type === 'bullish'
        ? exitPrice - this.position.entryPrice
        : this.position.entryPrice - exitPrice;

    const grossProfit =
      this.profitCalculator.calculateProfit(profitPoints) +
      FUTURES_CONSTANTS.COMMISSION_PER_CONTRACT * this.contractSize;

    // Validate the trade record
    const actualPointsMoved = Math.abs(exitPrice - this.position.entryPrice);
    if (actualPointsMoved > Math.max(this.stopLoss, this.takeProfit) + 1) {
      console.log(
        `⚠️ WARNING: Trade moved ${actualPointsMoved.toFixed(
          2
        )} points - exceeds expected range`
      );
    }

    return {
      entryDate: entryEST.date,
      entryTime: entryEST.time,
      entryPrice: this.position.entryPrice,
      exitDate: exitEST.date,
      exitTime: exitEST.time,
      exitPrice: exitPrice,
      type: this.position.type === 'bullish' ? 'LONG' : 'SHORT',
      contracts: this.contractSize,
      stopLoss: this.stopLoss,
      takeProfit: this.takeProfit,
      exitReason: exitReason,
      profitLoss: grossProfit,
      commission: FUTURES_CONSTANTS.COMMISSION_PER_CONTRACT * this.contractSize,
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

    const actualPointsMoved =
      this.position.type === 'bullish'
        ? exitPrice - this.position.entryPrice
        : this.position.entryPrice - exitPrice;

    console.log(
      `   📊 Trade Details: ${this.position.type.toUpperCase()} ` +
        `Entry: ${this.position.entryPrice.toFixed(
          2
        )} → Exit: ${exitPrice.toFixed(2)} ` +
        `(${actualPointsMoved.toFixed(2)} points) ` +
        `P&L: $${totalProfit.toFixed(2)} ` +
        `Reason: ${reason}`
    );

    // Validate P&L
    const validation = this.profitCalculator.validatePL(
      totalProfit,
      this.stopLoss,
      this.takeProfit
    );

    if (!validation.valid) {
      console.log(`   ⚠️ P&L VALIDATION FAILED: ${validation.message}`);
    }

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
