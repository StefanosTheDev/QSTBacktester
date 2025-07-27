// src/strategy/csvMain.ts - Updated with Intraday High/Low Tracking
import { ApiParams, CsvBar } from './types';
import { PositionManager } from './PositionManager';
import { SignalGenerator } from './SignalGenerator';
import { fitTrendlinesWindow } from './TrendLineAnalysis';
import { DailyLimitManager } from './DailyLimitManager';
import { streamCsvBars } from './readCSV';

export interface BacktestResult {
  count: number;
  logs: string[];
  statistics: {
    totalTrades: number;
    winRate: number;
    averageProfit: number;
    sharpeRatio: number;
    dailyPnL: Record<string, number>;
    maxDrawdown?: number;
    consecutiveStats?: { maxWins: number; maxLosses: number };
    profitFactor?: number;
    totalProfit?: number;
    avgWinLoss?: {
      avgWin: number;
      avgLoss: number;
      avgWinPoints: number;
      avgLossPoints: number;
    };
    // Daily limit stats
    daysHitStop?: number;
    daysHitTarget?: number;
    totalTradingDays?: number;
  };
  trades: TradeRecord[]; // For CSV export
  intradayStats?: Record<string, IntradayStats>; // NEW: Intraday highs/lows
}

export interface TradeRecord {
  entryDate: string;
  entryTime: string;
  entryPrice: number;
  exitDate: string;
  exitTime: string;
  exitPrice: number;
  type: 'LONG' | 'SHORT';
  contracts: number;
  stopLoss: number;
  takeProfit: number;
  exitReason: string;
  profitLoss: number;
  commission: number;
  netProfitLoss: number;
}

interface IntradayStats {
  date: string;
  maxHigh: number; // Highest P&L reached during the day
  maxLow: number; // Lowest P&L reached during the day
  finalPnL: number; // End of day P&L
  trades: number; // Number of trades
}

interface PendingSignal {
  type: 'bullish' | 'bearish';
  signalBar: CsvBar;
  entryPrice?: number;
}

export async function run(
  csvFiles: string[],
  formData: ApiParams
): Promise<BacktestResult> {
  const logs: string[] = [];

  // DEBUG: Environment info
  logs.push(`🔍 DEBUG - Environment: ${process.env.NODE_ENV || 'development'}`);
  logs.push(`🔍 DEBUG - Node Version: ${process.version}`);
  logs.push(
    `🔍 DEBUG - Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`
  );
  logs.push(`🔍 DEBUG - Current Time: ${new Date().toISOString()}`);
  logs.push(`🔍 DEBUG - Start Param: ${formData.start}`);
  logs.push(`🔍 DEBUG - End Param: ${formData.end}`);
  logs.push(`🔍 DEBUG - CSV Files: ${csvFiles.join(', ')}`);

  logs.push(`🚀 Starting backtest from ${formData.start} → ${formData.end}`);

  // Initialize trading components
  const positionManager = new PositionManager(
    formData.stopLoss,
    formData.takeProfit,
    formData.contractSize
  );
  const signalGenerator = new SignalGenerator();
  const dailyLimitManager = new DailyLimitManager(
    formData.maxDailyLoss,
    formData.maxDailyProfit
  );

  // Log daily limits
  if (formData.maxDailyLoss) {
    logs.push(`💰 Daily Loss Limit: $${formData.maxDailyLoss}`);
  }
  if (formData.maxDailyProfit) {
    logs.push(`🎯 Daily Profit Target: $${formData.maxDailyProfit}`);
  }

  // Trading state
  let lastSignal: 'bullish' | 'bearish' | null = null;
  let prevBar: CsvBar | null = null;
  let pendingSignal: PendingSignal | null = null;
  const trades: TradeRecord[] = [];

  // Intraday tracking
  const intradayStats: Record<string, IntradayStats> = {};
  let currentDayPnL = 0;
  let currentDayMaxHigh = 0;
  let currentDayMaxLow = 0;
  let currentDayTrades = 0;

  // Windows for analysis (will contain HISTORICAL data only)
  const cvdWindow: number[] = [];
  const priceWindow: number[] = [];
  const volumeWindow: number[] = [];

  // Extract parameters
  const filterParams = {
    emaMovingAverage: formData.emaMovingAverage || undefined,
    adxPeriod: formData.adxPeriod || undefined,
    adxThreshold: formData.adxThreshold || undefined,
    cvdLookBackBars: formData.cvdLookBackBars || 5,
  };

  let count = 0;
  let isFirstBar = true;
  let currentDay = '';
  let firstBarLogged = false;
  let lastBarTimestamp = '';

  for await (const bar of streamCsvBars(
    csvFiles,
    formData.start,
    formData.end,
    filterParams
  )) {
    count++;

    // DEBUG: Log first 3 bars
    if (count <= 3) {
      logs.push(
        `🔍 DEBUG - Bar ${count}: ${JSON.stringify({
          timestamp: bar.timestamp,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          cvd_close: bar.cvd_close,
        })}`
      );
    }

    if (!firstBarLogged) {
      logs.push(`🔍 DEBUG - First Bar Timestamp: ${bar.timestamp}`);
      firstBarLogged = true;
    }
    lastBarTimestamp = bar.timestamp;

    // Check if it's a new day
    const barDay = new Date(bar.timestamp).toLocaleDateString('en-US');
    if (barDay !== currentDay) {
      // Save previous day's stats
      if (currentDay !== '') {
        intradayStats[currentDay] = {
          date: currentDay,
          maxHigh: currentDayMaxHigh,
          maxLow: currentDayMaxLow,
          finalPnL: currentDayPnL,
          trades: currentDayTrades,
        };
      }

      // Reset for new day
      currentDay = barDay;
      currentDayPnL = dailyLimitManager.getCurrentDayPnL(bar.timestamp);
      currentDayMaxHigh = currentDayPnL;
      currentDayMaxLow = currentDayPnL;
      currentDayTrades = 0;

      if (currentDayPnL !== 0) {
        logs.push(
          `📅 New day: ${barDay} (Previous day P&L: $${currentDayPnL.toFixed(
            2
          )})`
        );
      }
    }

    // Skip first bar (no previous bar to enter on)
    if (isFirstBar) {
      isFirstBar = false;
      prevBar = bar;
      continue;
    }

    // Extract hour and minute from bar timestamp
    const barDate = new Date(bar.timestamp);
    const barHour = barDate.getHours();
    const barMinute = barDate.getMinutes();

    // FIRST: Force exit if near market close (3:55 PM = 15:55)
    if (positionManager.hasPosition() && barHour === 15 && barMinute >= 55) {
      const exitResult = positionManager.forceExit(bar, 'end-of-day');
      if (exitResult.exited) {
        const exitDateTime = new Date(bar.timestamp);
        const exitDateStr = exitDateTime.toLocaleDateString('en-US');
        const exitTimeStr = exitDateTime.toLocaleTimeString('en-US');

        logs.push(
          `🕐 Forced Exit: end-of-day @ ${exitResult.exitPrice?.toFixed(
            2
          )} on ${exitDateStr} ${exitTimeStr} - Profit: ${exitResult.profit?.toFixed(
            2
          )}`
        );

        // Record the trade with daily limit manager
        const limitResult = dailyLimitManager.recordTrade(
          bar.timestamp,
          exitResult.profit || 0
        );

        // Update intraday tracking
        currentDayPnL += limitResult.cappedProfit || exitResult.profit || 0;
        currentDayMaxHigh = Math.max(currentDayMaxHigh, currentDayPnL);
        currentDayMaxLow = Math.min(currentDayMaxLow, currentDayPnL);
        currentDayTrades++;

        if (exitResult.tradeRecord) {
          trades.push(exitResult.tradeRecord);
        }

        lastSignal = null;
        pendingSignal = null;
      }
    }

    // SECOND: Check for normal position exits
    if (positionManager.hasPosition()) {
      const exitResult = positionManager.checkExit(bar);
      if (exitResult.exited) {
        const exitDateTime = new Date(bar.timestamp);
        const exitDateStr = exitDateTime.toLocaleDateString('en-US');
        const exitTimeStr = exitDateTime.toLocaleTimeString('en-US');

        // Record the trade with daily limit manager
        const limitResult = dailyLimitManager.recordTrade(
          bar.timestamp,
          exitResult.profit || 0
        );

        // Update intraday tracking
        currentDayPnL += limitResult.cappedProfit || exitResult.profit || 0;
        currentDayMaxHigh = Math.max(currentDayMaxHigh, currentDayPnL);
        currentDayMaxLow = Math.min(currentDayMaxLow, currentDayPnL);
        currentDayTrades++;

        // Use the capped profit for display and statistics
        const displayProfit =
          limitResult.cappedProfit || exitResult.profit || 0;

        logs.push(
          `🚪 Exit: ${exitResult.reason} @ ${exitResult.exitPrice?.toFixed(
            2
          )} on ${exitDateStr} ${exitTimeStr} - Profit: $${displayProfit.toFixed(
            2
          )}`
        );

        if (!limitResult.allowed) {
          logs.push(`🛑 ${limitResult.reason}`);
        }

        // Store trade for CSV export with actual profit (not capped)
        if (exitResult.tradeRecord) {
          // Add note if profit was capped
          if (limitResult.cappedProfit !== exitResult.profit) {
            exitResult.tradeRecord.exitReason += ` (capped from $${exitResult.profit?.toFixed(
              2
            )})`;
          }
          trades.push(exitResult.tradeRecord);
        }

        lastSignal = null;
        pendingSignal = null;
      }
    }

    // THIRD: Execute pending entry signal at market open
    if (pendingSignal && !positionManager.hasPosition()) {
      // Enter at the open of current bar (realistic execution)
      const entryPrice = bar.open;

      // Validate that entry is still valid (price didn't gap too far)
      const gapPercent =
        Math.abs(bar.open - pendingSignal.signalBar.close) /
        pendingSignal.signalBar.close;

      if (gapPercent < 0.02) {
        // Max 2% gap tolerance
        const position = positionManager.enterPosition(
          pendingSignal.type,
          entryPrice,
          bar
        );
        const entryDateTime = new Date(bar.timestamp);
        const entryDateStr = entryDateTime.toLocaleDateString('en-US');
        const entryTimeStr = entryDateTime.toLocaleTimeString('en-US');

        logs.push(
          `📈 Entry: ${pendingSignal.type.toUpperCase()} @ ${entryPrice.toFixed(
            2
          )} on ${entryDateStr} ${entryTimeStr} | Stop: ${position.stopPrice.toFixed(
            2
          )} | Target: ${position.targetPrice.toFixed(2)}`
        );
        lastSignal = pendingSignal.type;
      } else {
        logs.push(
          `⚠️ Entry skipped: Gap too large (${(gapPercent * 100).toFixed(2)}%)`
        );
      }

      pendingSignal = null;
    }

    // Update windows with PREVIOUS bar data (no look-ahead)
    if (prevBar) {
      cvdWindow.push(prevBar.cvd_close || 0);
      priceWindow.push(prevBar.close);
      volumeWindow.push(prevBar.volume);

      // Maintain window size
      if (cvdWindow.length > filterParams.cvdLookBackBars) {
        cvdWindow.shift();
        priceWindow.shift();
        volumeWindow.shift();
      }
    }

    // Wait for sufficient historical data
    if (cvdWindow.length < filterParams.cvdLookBackBars) {
      prevBar = bar;
      continue;
    }

    // FOURTH: Generate signals (only if not in position and no pending signal)
    if (!positionManager.hasPosition() && !pendingSignal) {
      // Analyze using HISTORICAL data only
      const trendlines = fitTrendlinesWindow(cvdWindow);
      let signal = trendlines.breakout;

      // Get indicator values for validation
      const emaValue = filterParams.emaMovingAverage
        ? (bar[
            `ema_${filterParams.emaMovingAverage}` as keyof CsvBar
          ] as number)
        : undefined;
      const prevEmaValue =
        filterParams.emaMovingAverage && prevBar
          ? (prevBar[
              `ema_${filterParams.emaMovingAverage}` as keyof CsvBar
            ] as number)
          : undefined;
      const adxValue = bar.adx;

      // Validate signal with current bar data
      signal = signalGenerator.validateSignal(signal, trendlines, {
        lastSignal,
        priceWindow,
        volumeWindow,
        bar,
        prevBar,
        emaValue,
        prevEmaValue,
        adxValue,
        adxThreshold: filterParams.adxThreshold,
      });

      // Queue signal for next bar entry
      if (signal !== 'none') {
        pendingSignal = {
          type: signal,
          signalBar: bar,
        };
        const signalDateTime = new Date(bar.timestamp);
        const signalDateStr = signalDateTime.toLocaleDateString('en-US');
        const signalTimeStr = signalDateTime.toLocaleTimeString('en-US');

        logs.push(
          `🔔 Signal generated: ${signal.toUpperCase()} on ${signalDateStr} ${signalTimeStr} - Will enter on next bar open`
        );
      }
    }

    prevBar = bar;
  }

  // Save final day's stats
  if (currentDay !== '') {
    intradayStats[currentDay] = {
      date: currentDay,
      maxHigh: currentDayMaxHigh,
      maxLow: currentDayMaxLow,
      finalPnL: currentDayPnL,
      trades: currentDayTrades,
    };
  }

  // DEBUG: Final bar info
  logs.push(`🔍 DEBUG - Last Bar Timestamp: ${lastBarTimestamp}`);
  logs.push(`🔍 DEBUG - Total Bars Processed: ${count}`);

  // Get final statistics
  const baseStats = positionManager.getStatistics().getStatistics();
  const dailyLimitStats = dailyLimitManager.getSummary();

  // Override with capped values
  const stats: BacktestResult['statistics'] = {
    ...baseStats,
    totalProfit: dailyLimitStats.totalCappedPnL,
    dailyPnL: dailyLimitManager.getDailyCappedPnL(), // Use capped daily P&L
    daysHitStop: dailyLimitStats.daysHitStop,
    daysHitTarget: dailyLimitStats.daysHitTarget,
    totalTradingDays: dailyLimitStats.totalDays,
    avgWinLoss: baseStats.avgWinLoss as {
      avgWin: number;
      avgLoss: number;
      avgWinPoints: number;
      avgLossPoints: number;
    },
  };

  // Recalculate average profit based on capped total
  if (stats.totalTrades > 0 && stats.totalProfit !== undefined) {
    stats.averageProfit = stats.totalProfit / stats.totalTrades;
  }

  logs.push(`\n🎉 Backtest complete. Processed ${count} bars.`);
  logs.push(
    `📊 Results: ${stats.totalTrades} trades, ${stats.winRate.toFixed(
      2
    )}% win rate, ${stats.averageProfit.toFixed(2)} avg profit`
  );

  // Add average win/loss analysis to help debug
  if (baseStats.avgWinLoss) {
    logs.push(`\n📈 Win/Loss Analysis:`);
    logs.push(
      `   - Avg Win: ${baseStats.avgWinLoss.avgWin.toFixed(
        2
      )} (${baseStats.avgWinLoss.avgWinPoints.toFixed(2)} points)`
    );
    logs.push(
      `   - Avg Loss: ${baseStats.avgWinLoss.avgLoss.toFixed(
        2
      )} (${baseStats.avgWinLoss.avgLossPoints.toFixed(2)} points)`
    );
    logs.push(
      `   - Expected Win Points: ${formData.takeProfit.toFixed(
        2
      )}, Actual: ${baseStats.avgWinLoss.avgWinPoints.toFixed(2)}`
    );
    logs.push(
      `   - Expected Loss Points: ${formData.stopLoss.toFixed(
        2
      )}, Actual: ${baseStats.avgWinLoss.avgLossPoints.toFixed(2)}`
    );
  }

  // Add daily limit summary
  if (formData.maxDailyLoss || formData.maxDailyProfit) {
    logs.push(`\n📊 Daily Limit Summary:`);
    logs.push(`   - Trading Days: ${dailyLimitStats.totalDays}`);
    logs.push(
      `   - Profitable Days: ${dailyLimitStats.profitableDays} (${(
        (dailyLimitStats.profitableDays / dailyLimitStats.totalDays) *
        100
      ).toFixed(1)}%)`
    );
    logs.push(`   - Losing Days: ${dailyLimitStats.losingDays}`);

    if (formData.maxDailyLoss) {
      logs.push(`   - Days Hit Stop Loss: ${dailyLimitStats.daysHitStop}`);
    }
    if (formData.maxDailyProfit) {
      logs.push(
        `   - Days Hit Profit Target: ${dailyLimitStats.daysHitTarget}`
      );
    }

    logs.push(`   - Best Day: $${dailyLimitStats.bestDay.toFixed(2)}`);
    logs.push(`   - Worst Day: $${dailyLimitStats.worstDay.toFixed(2)}`);
    logs.push(
      `\n   - Total P&L (with limits): $${dailyLimitStats.totalCappedPnL.toFixed(
        2
      )}`
    );
    logs.push(
      `   - Total P&L (without limits): $${dailyLimitStats.totalActualPnL.toFixed(
        2
      )}`
    );

    const difference =
      dailyLimitStats.totalActualPnL - dailyLimitStats.totalCappedPnL;
    if (Math.abs(difference) > 0.01) {
      logs.push(`   - Difference: $${difference.toFixed(2)}`);
    }
  }

  return {
    count,
    logs,
    statistics: stats,
    trades,
    intradayStats, // Include the intraday stats
  };
}
