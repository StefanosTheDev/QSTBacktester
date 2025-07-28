// src/strategy/BacktestEngine.ts
import { ApiParams, CsvBar } from '../types/types';
import { PositionManager } from '../core/PositionManager';
import { SignalGenerator } from '../core/SignalGenerator';
import { DailyLimitManager } from '../core/DailyLimitManager';
import { BacktestLogger } from '../utils/BackTestLogger';
import { DateTimeUtils } from '../utils/DateTimeUtils';
import { GapDetector } from '../validation/GapDetector';
import { TradeValidator } from '../validation/TradeValidator';
import { BarProcessor } from './BarProcessor';
import { BacktestResult, IntradayStats, PendingSignal } from './BacktestTypes';
import { TradeRecord } from '../types/types';
import { ExitResult } from '../trading/PositionTypes';
export class BacktestEngine {
  private logger: BacktestLogger;
  private positionManager: PositionManager;
  private signalGenerator: SignalGenerator;
  private dailyLimitManager: DailyLimitManager;
  private barProcessor: BarProcessor;

  // State
  private trades: TradeRecord[] = [];
  private intradayStats: Record<string, IntradayStats> = {};
  private pendingSignal: PendingSignal | null = null;
  private lastSignal: 'bullish' | 'bearish' | null = null;

  constructor(private formData: ApiParams) {
    this.logger = new BacktestLogger();
    this.positionManager = new PositionManager(
      formData.stopLoss,
      formData.takeProfit,
      formData.contractSize,
      formData.useTrailingStop || false,
      formData.breakevenTrigger || 3,
      formData.trailDistance || 2
    );
    this.signalGenerator = new SignalGenerator();
    this.dailyLimitManager = new DailyLimitManager(
      formData.maxDailyLoss,
      formData.maxDailyProfit
    );
    this.barProcessor = new BarProcessor(
      formData.cvdLookBackBars || 5,
      formData.emaMovingAverage,
      formData.adxThreshold
    );
  }

  async run(csvFiles: string[]): Promise<BacktestResult> {
    // Initialize logging
    this.logger.logTimezoneDiagnostics();
    this.logConfiguration();

    // Process bars
    const processResult = await this.barProcessor.processBars(
      csvFiles,
      this.formData.start,
      this.formData.end,
      (bar, prevBar, isFirstBar) => this.processBar(bar, prevBar, isFirstBar)
    );

    // Generate final results
    return this.generateResults(processResult.count);
  }

  private processBar(
    bar: CsvBar,
    prevBar: CsvBar | null,
    isFirstBar: boolean
  ): void {
    if (isFirstBar) return;

    // Check for gaps
    if (prevBar && this.checkGaps(bar, prevBar)) {
      return;
    }

    // Check daily limits
    if (!this.dailyLimitManager.canTrade(bar.timestamp)) {
      this.handleDailyLimitReached(bar);
      return;
    }

    // Check for end of day exit
    if (this.shouldForceEndOfDayExit(bar)) {
      this.forceEndOfDayExit(bar);
    }

    // Check for normal exits
    if (this.positionManager.hasPosition()) {
      this.checkPositionExit(bar);
    }

    // Execute pending entries
    if (this.pendingSignal && !this.positionManager.hasPosition()) {
      this.executePendingEntry(bar);
    }

    // Generate new signals
    if (!this.positionManager.hasPosition() && !this.pendingSignal) {
      this.generateSignals(bar, prevBar);
    }
  }

  private checkGaps(bar: CsvBar, prevBar: CsvBar): boolean {
    const gapResult = GapDetector.detectGap(bar, prevBar);

    if (gapResult.isSignificant) {
      this.logger.logGap(
        gapResult.gapPoints,
        gapResult.gapPercent,
        prevBar.close,
        bar.open
      );

      if (this.positionManager.hasPosition()) {
        this.logger.log(
          `🚨 WARNING: Open position during ${gapResult.gapPercent.toFixed(
            2
          )}% gap - ` + `EXIT WILL BE LIMITED TO 0.25 POINT SLIPPAGE`
        );
      }

      if (gapResult.isExtreme && this.pendingSignal) {
        this.logger.log(
          `❌ Cancelling pending signal due to extreme gap (${gapResult.gapPercent.toFixed(
            2
          )}%)`
        );
        this.pendingSignal = null;
      }
    }

    return false;
  }

  private checkPositionExit(bar: CsvBar): void {
    const exitResult = this.positionManager.checkExit(bar);
    if (exitResult.exited) {
      this.handleExit(bar, exitResult);
    }
  }

  private handleExit(bar: CsvBar, exitResult: ExitResult): void {
    const exitDateStr = DateTimeUtils.getDateKey(bar.timestamp);
    const exitTimeStr = DateTimeUtils.formatForLog(bar.timestamp);

    // Record with daily limit manager
    const limitResult = this.dailyLimitManager.recordTrade(
      bar.timestamp,
      exitResult.profit || 0
    );

    // Update intraday tracking

    // Log exit
    const actualPoints = exitResult.tradeRecord
      ? Math.abs(
          exitResult.tradeRecord.exitPrice - exitResult.tradeRecord.entryPrice
        )
      : 0;

    this.logger.logExit(
      exitResult.reason!,
      exitResult.exitPrice!,
      exitDateStr,
      exitTimeStr,
      exitResult.profit!,
      actualPoints
    );

    if (!limitResult.allowed) {
      this.logger.logDailyLimit(limitResult.reason!);
      this.pendingSignal = null;
    }

    if (exitResult.tradeRecord) {
      this.trades.push(exitResult.tradeRecord);
    }

    this.lastSignal = null;
    this.pendingSignal = null;
  }

  private executePendingEntry(bar: CsvBar): void {
    if (
      !this.pendingSignal ||
      !this.dailyLimitManager.canTrade(bar.timestamp)
    ) {
      return;
    }

    const entryPrice = bar.open;

    if (
      GapDetector.isGapWithinTolerance(
        this.pendingSignal.signalBar.close,
        entryPrice
      )
    ) {
      const position = this.positionManager.enterPosition(
        this.pendingSignal.type,
        entryPrice,
        bar
      );

      const entryDateStr = DateTimeUtils.getDateKey(bar.timestamp);
      const entryTimeStr = DateTimeUtils.formatForLog(bar.timestamp);

      this.logger.logEntry(
        this.pendingSignal.type,
        entryPrice,
        entryDateStr,
        entryTimeStr,
        position.stopPrice,
        position.targetPrice
      );

      this.lastSignal = this.pendingSignal.type;
    } else {
      const gapPercent =
        (Math.abs(bar.open - this.pendingSignal.signalBar.close) /
          this.pendingSignal.signalBar.close) *
        100;
      this.logger.log(
        `⚠️ Entry skipped: Gap too large (${gapPercent.toFixed(
          2
        )}%) - Would result in unrealistic entry`
      );
    }

    this.pendingSignal = null;
  }

  private generateSignals(bar: CsvBar, prevBar: CsvBar | null): void {
    if (!this.dailyLimitManager.canTrade(bar.timestamp)) return;

    const signal = this.barProcessor.generateSignal(
      bar,
      prevBar,
      this.lastSignal,
      this.signalGenerator
    );

    if (signal !== 'none') {
      this.pendingSignal = {
        type: signal,
        signalBar: bar,
      };

      const signalDateStr = DateTimeUtils.getDateKey(bar.timestamp);
      const signalTimeStr = DateTimeUtils.formatForLog(bar.timestamp);

      this.logger.logSignal(signal, signalDateStr, signalTimeStr);
    }
  }

  private generateResults(count: number): BacktestResult {
    const baseStats = this.positionManager.getStatistics().getStatistics();
    const dailyLimitStats = this.dailyLimitManager.getSummary();

    // Validate trades
    const validation = TradeValidator.validateTrades(
      this.trades,
      this.formData.stopLoss,
      this.formData.takeProfit,
      this.formData.contractSize
    );

    const validationLogs = TradeValidator.generateValidationSummary(
      validation,
      this.formData.stopLoss,
      this.formData.takeProfit,
      this.formData.contractSize
    );

    validationLogs.forEach((log) => this.logger.log(log));

    // Create final statistics - baseStats now includes longShortStats
    const statistics = {
      ...baseStats,
      totalProfit: dailyLimitStats.totalActualPnL,
      dailyPnL: this.dailyLimitManager.getDailyActualPnL(),
      daysHitStop: dailyLimitStats.daysHitStop,
      daysHitTarget: dailyLimitStats.daysHitTarget,
      totalTradingDays: dailyLimitStats.totalDays,
      actualTotalProfit: dailyLimitStats.totalActualPnL,
      actualDailyPnL: this.dailyLimitManager.getDailyActualPnL(),
    };

    // Log summary
    this.logger.logBacktestSummary(
      count,
      statistics.totalTrades,
      statistics.winRate,
      statistics.averageProfit
    );

    return {
      count,
      logs: this.logger.getLogs(),
      statistics,
      trades: this.trades,
      intradayStats: this.intradayStats,
    };
  }

  private handleDailyLimitReached(bar: CsvBar): void {
    if (this.positionManager.hasPosition()) {
      const exitResult = this.positionManager.forceExit(
        bar,
        'daily-limit-reached'
      );
      if (exitResult.exited) {
        this.handleExit(bar, exitResult);
      }
    }
  }

  private shouldForceEndOfDayExit(bar: CsvBar): boolean {
    const { hour, minute } = DateTimeUtils.getTimeComponents(bar.timestamp);
    return this.positionManager.hasPosition() && hour === 15 && minute >= 55;
  }

  private forceEndOfDayExit(bar: CsvBar): void {
    const exitResult = this.positionManager.forceExit(bar, 'end-of-day');
    if (exitResult.exited) {
      this.handleExit(bar, exitResult);
    }
  }

  private logConfiguration(): void {
    this.logger.log(
      `🚀 Starting backtest from ${this.formData.start} → ${this.formData.end}`
    );

    if (this.formData.useTrailingStop) {
      this.logger.log(`📈 Trailing Stop Enabled:`);
      this.logger.log(
        `   - Breakeven Trigger: ${this.formData.breakevenTrigger} points`
      );
      this.logger.log(
        `   - Trail Distance: ${this.formData.trailDistance} points`
      );
    } else {
      this.logger.log(
        `📊 Using Static Stops: ${this.formData.stopLoss} points`
      );
    }

    if (this.formData.maxDailyLoss) {
      this.logger.log(`💰 Daily Loss Limit: $${this.formData.maxDailyLoss}`);
    }
    if (this.formData.maxDailyProfit) {
      this.logger.log(
        `🎯 Daily Profit Target: $${this.formData.maxDailyProfit}`
      );
    }
  }
}
