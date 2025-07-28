// src/strategy/csvMain.ts - Fixed with Proper Daily Limit Enforcement and Timezone Handling
import { ApiParams, CsvBar } from './types';
import { PositionManager } from './PositionManager';
import { SignalGenerator } from './SignalGenerator';
import { fitTrendlinesWindow } from './TrendLineAnalysis';
import { DailyLimitManager } from './DailyLimitManager';
import { streamCsvBars } from './readCSV';
process.env.TZ = 'America/Los_Angeles';

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
    // Add actual (uncapped) metrics
    actualTotalProfit?: number;
    actualDailyPnL?: Record<string, number>;
  };
  trades: TradeRecord[]; // For CSV export
  intradayStats?: Record<string, IntradayStats>; // Intraday highs/lows
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

// Utility function for consistent date formatting (matches DailyLimitManager)
function getDateKey(timestamp: string): string {
  const datePart = timestamp.split(' ')[0];

  if (datePart && datePart.includes('-')) {
    const [year, month, day] = datePart.split('-');
    return `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
  }

  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

export async function run(
  csvFiles: string[],
  formData: ApiParams
): Promise<BacktestResult> {
  const logs: string[] = [];

  // ENHANCED TIMEZONE DEBUGGING
  logs.push(`\n🌍 ENHANCED TIMEZONE DIAGNOSTICS:`);
  logs.push(
    `   - Server Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`
  );
  logs.push(`   - Server Time Now: ${new Date().toString()}`);
  logs.push(
    `   - Server UTC Offset: ${new Date().getTimezoneOffset()} minutes`
  );
  logs.push(`   - NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  logs.push(`   - TZ env var: ${process.env.TZ || 'not set'}`);

  // Test date parsing with your actual input format
  const testTimestamp = '2025-01-15 09:30:00 AM';
  logs.push(`\n🔍 PARSING TEST for: "${testTimestamp}"`);

  // Method 1: Direct Date constructor
  const method1 = new Date(testTimestamp);
  logs.push(`   Method 1 (new Date()): ${method1.toString()}`);
  logs.push(`   Method 1 ISO: ${method1.toISOString()}`);
  logs.push(`   Method 1 Hours: ${method1.getHours()}`);

  // Test with actual start/end parameters
  logs.push(`\n📅 ACTUAL PARAMETERS:`);
  logs.push(`   - Start param: "${formData.start}"`);
  logs.push(`   - End param: "${formData.end}"`);

  // Test getDateKey function
  logs.push(`\n🔑 DATE KEY TESTS:`);
  const testDates = ['2025-01-15 09:30:00 AM', '01/15/2025', '2025-01-15'];
  testDates.forEach((td) => {
    logs.push(`   - getDateKey("${td}") = "${getDateKey(td)}"`);
  });

  logs.push(
    `\n🔍 DEBUG - Environment: ${process.env.NODE_ENV || 'development'}`
  );
  logs.push(`🔍 DEBUG - Node Version: ${process.version}`);
  logs.push(`🔍 DEBUG - Start Param: ${formData.start}`);
  logs.push(`🔍 DEBUG - End Param: ${formData.end}`);
  logs.push(`🔍 DEBUG - CSV Files: ${csvFiles.join(', ')}`);

  logs.push(`🚀 Starting backtest from ${formData.start} → ${formData.end}`);

  // Initialize trading components with trailing stop config
  const positionManager = new PositionManager(
    formData.stopLoss,
    formData.takeProfit,
    formData.contractSize,
    formData.useTrailingStop || false,
    formData.breakevenTrigger || 3,
    formData.trailDistance || 2
  );

  // Log trailing stop configuration
  if (formData.useTrailingStop) {
    logs.push(`📈 Trailing Stop Enabled:`);
    logs.push(`   - Breakeven Trigger: ${formData.breakevenTrigger} points`);
    logs.push(`   - Trail Distance: ${formData.trailDistance} points`);
  } else {
    logs.push(`📊 Using Static Stops: ${formData.stopLoss} points`);
  }

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

  // Bar tracking for debugging
  let barsInTimeWindow = 0;
  let barsProcessed = 0;

  for await (const bar of streamCsvBars(
    csvFiles,
    formData.start,
    formData.end,
    filterParams
  )) {
    count++;
    barsInTimeWindow++;

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
      logs.push(`🔍 DEBUG - First Bar DateKey: ${getDateKey(bar.timestamp)}`);
      firstBarLogged = true;
    }
    lastBarTimestamp = bar.timestamp;

    // Check if it's a new day using consistent date formatting
    const barDay = getDateKey(bar.timestamp);
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

      // Check if new day has already hit limits (shouldn't happen, but be safe)
      if (!dailyLimitManager.canTrade(bar.timestamp)) {
        logs.push(
          `⛔ Trading disabled for ${barDay} - Daily limit already reached`
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

    // CHECK FOR EXTREME GAPS
    if (prevBar) {
      const gapPoints = Math.abs(bar.open - prevBar.close);
      const gapPercent = gapPoints / prevBar.close;

      // Flag gaps larger than 10 points as extreme (0.2% for ES around 5000)
      if (gapPoints > 10) {
        logs.push(
          `⚠️ EXTREME GAP DETECTED: ${gapPoints.toFixed(2)} points (${(
            gapPercent * 100
          ).toFixed(2)}%) - ` +
            `Previous close: ${prevBar.close.toFixed(
              2
            )}, Current open: ${bar.open.toFixed(2)}`
        );

        // If we have a position during an extreme gap, we need to exit it
        if (positionManager.hasPosition()) {
          logs.push(
            `🚨 CRITICAL: Open position during extreme gap - EXIT WILL BE LIMITED TO REALISTIC SLIPPAGE`
          );
          // The position manager will handle the exit with 0.25 point max slippage
        }

        // Don't allow new entries during extreme gaps
        if (pendingSignal) {
          logs.push(`❌ Cancelling pending signal due to extreme gap`);
          pendingSignal = null;
        }

        // Skip processing new signals during extreme gap bars
        // This prevents entering new positions when market is gapping
      }
    }

    // FIRST: Check if we can still trade today
    if (!dailyLimitManager.canTrade(bar.timestamp)) {
      // If we have a position but can't trade, we need to exit it
      if (positionManager.hasPosition()) {
        const exitResult = positionManager.forceExit(
          bar,
          'daily-limit-reached'
        );
        if (exitResult.exited) {
          const exitDateStr = getDateKey(bar.timestamp);
          const exitDateTime = new Date(bar.timestamp);
          const exitTimeStr = exitDateTime.toLocaleTimeString('en-US');

          logs.push(
            `🛑 Forced Exit: daily-limit-reached @ ${exitResult.exitPrice?.toFixed(
              2
            )} on ${exitDateStr} ${exitTimeStr} - Profit: ${exitResult.profit?.toFixed(
              2
            )}`
          );

          // Record the trade
          dailyLimitManager.recordTrade(bar.timestamp, exitResult.profit || 0);

          // Update intraday tracking
          currentDayPnL = dailyLimitManager.getCurrentDayPnL(bar.timestamp);
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

      // Skip all other processing for this bar
      prevBar = bar;
      continue;
    }

    // SECOND: Force exit if near market close (3:55 PM = 15:55)
    if (positionManager.hasPosition() && barHour === 15 && barMinute >= 55) {
      const exitResult = positionManager.forceExit(bar, 'end-of-day');
      if (exitResult.exited) {
        const exitDateStr = getDateKey(bar.timestamp);
        const exitDateTime = new Date(bar.timestamp);
        const exitTimeStr = exitDateTime.toLocaleTimeString('en-US');

        logs.push(
          `🕐 Forced Exit: end-of-day @ ${exitResult.exitPrice?.toFixed(
            2
          )} on ${exitDateStr} ${exitTimeStr} - Profit: ${exitResult.profit?.toFixed(
            2
          )}`
        );

        // Record the trade with daily limit manager
        dailyLimitManager.recordTrade(bar.timestamp, exitResult.profit || 0);

        // Update intraday tracking
        currentDayPnL = dailyLimitManager.getCurrentDayPnL(bar.timestamp);
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

    // THIRD: Check for normal position exits
    if (positionManager.hasPosition()) {
      const exitResult = positionManager.checkExit(bar);
      if (exitResult.exited) {
        const exitDateStr = getDateKey(bar.timestamp);
        const exitDateTime = new Date(bar.timestamp);
        const exitTimeStr = exitDateTime.toLocaleTimeString('en-US');

        // Record the trade with daily limit manager
        const limitResult = dailyLimitManager.recordTrade(
          bar.timestamp,
          exitResult.profit || 0
        );

        // Update intraday tracking
        currentDayPnL = dailyLimitManager.getCurrentDayPnL(bar.timestamp);
        currentDayMaxHigh = Math.max(currentDayMaxHigh, currentDayPnL);
        currentDayMaxLow = Math.min(currentDayMaxLow, currentDayPnL);
        currentDayTrades++;

        // Enhanced logging with actual points moved
        const actualPoints = exitResult.tradeRecord
          ? Math.abs(
              exitResult.tradeRecord.exitPrice -
                exitResult.tradeRecord.entryPrice
            )
          : 0;

        logs.push(
          `🚪 Exit: ${exitResult.reason} @ ${exitResult.exitPrice?.toFixed(
            2
          )} on ${exitDateStr} ${exitTimeStr} - Profit: $${exitResult.profit?.toFixed(
            2
          )} (${actualPoints.toFixed(2)} points)`
        );

        if (!limitResult.allowed) {
          logs.push(`🛑 ${limitResult.reason}`);
          logs.push(`⛔ STOPPING TRADING FOR THE DAY - Daily limit reached`);
          pendingSignal = null; // Clear any pending signals
        }

        // Store trade for CSV export
        if (exitResult.tradeRecord) {
          trades.push(exitResult.tradeRecord);
        }

        lastSignal = null;
        pendingSignal = null;
      }
    }

    // FOURTH: Execute pending entry signal at market open (only if we can still trade)
    if (
      pendingSignal &&
      !positionManager.hasPosition() &&
      dailyLimitManager.canTrade(bar.timestamp)
    ) {
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
        const entryDateStr = getDateKey(bar.timestamp);
        const entryDateTime = new Date(bar.timestamp);
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

    // FIFTH: Generate signals (only if not in position, no pending signal, and can trade)
    if (
      !positionManager.hasPosition() &&
      !pendingSignal &&
      dailyLimitManager.canTrade(bar.timestamp)
    ) {
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
        const signalDateStr = getDateKey(bar.timestamp);
        const signalDateTime = new Date(bar.timestamp);
        const signalTimeStr = signalDateTime.toLocaleTimeString('en-US');

        logs.push(
          `🔔 Signal generated: ${signal.toUpperCase()} on ${signalDateStr} ${signalTimeStr} - Will enter on next bar open`
        );
      }
    }

    prevBar = bar;
    barsProcessed++;
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
  logs.push(`🔍 DEBUG - Last Bar DateKey: ${getDateKey(lastBarTimestamp)}`);
  logs.push(`🔍 DEBUG - Total Bars Processed: ${count}`);

  // Bar statistics
  logs.push(`\n📊 BAR STATISTICS:`);
  logs.push(`   - Total bars in time window: ${barsInTimeWindow}`);
  logs.push(`   - Bars processed after filters: ${barsProcessed}`);
  logs.push(`   - Bars skipped: ${count - barsProcessed}`);

  // Get final statistics
  const baseStats = positionManager.getStatistics().getStatistics();
  const dailyLimitStats = dailyLimitManager.getSummary();

  // Create statistics with BOTH capped and actual values
  const stats: BacktestResult['statistics'] = {
    ...baseStats,
    totalProfit: dailyLimitStats.totalActualPnL, // Use ACTUAL P&L as the main metric
    dailyPnL: dailyLimitManager.getDailyActualPnL(), // Use ACTUAL daily P&L
    daysHitStop: dailyLimitStats.daysHitStop,
    daysHitTarget: dailyLimitStats.daysHitTarget,
    totalTradingDays: dailyLimitStats.totalDays,
    avgWinLoss: baseStats.avgWinLoss as {
      avgWin: number;
      avgLoss: number;
      avgWinPoints: number;
      avgLossPoints: number;
    },
    // Include actual values for transparency
    actualTotalProfit: dailyLimitStats.totalActualPnL,
    actualDailyPnL: dailyLimitManager.getDailyActualPnL(),
  };

  // Recalculate average profit based on actual total
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
      `\n   - Total P&L (ACTUAL): $${dailyLimitStats.totalActualPnL.toFixed(2)}`
    );
    logs.push(
      `   - Total P&L (if capped): $${dailyLimitStats.totalCappedPnL.toFixed(
        2
      )}`
    );

    const difference =
      dailyLimitStats.totalActualPnL - dailyLimitStats.totalCappedPnL;
    if (Math.abs(difference) > 0.01) {
      logs.push(
        `   - Difference (impact of limits): $${difference.toFixed(2)}`
      );
    }
  }

  // Validate trades against expected P&L
  logs.push(`\n🔍 Trade Validation Summary:`);

  const expectedWinPL =
    (formData.takeProfit / 0.25) * 12.5 * formData.contractSize -
    2.5 * formData.contractSize;
  const expectedLossPL =
    -(formData.stopLoss / 0.25) * 12.5 * formData.contractSize -
    2.5 * formData.contractSize;

  logs.push(
    `   - Expected Win P&L: $${expectedWinPL.toFixed(2)} (${
      formData.takeProfit
    } points)`
  );
  logs.push(
    `   - Expected Loss P&L: $${expectedLossPL.toFixed(2)} (${
      formData.stopLoss
    } points)`
  );

  // Check for anomalies
  let anomalies = 0;
  let extremeAnomalies = 0;
  trades.forEach((trade, idx) => {
    const pointsMoved = Math.abs(trade.exitPrice - trade.entryPrice);
    const isAnomaly =
      (trade.netProfitLoss > 0 &&
        Math.abs(trade.netProfitLoss - expectedWinPL) > expectedWinPL * 0.1) ||
      (trade.netProfitLoss < 0 &&
        Math.abs(trade.netProfitLoss - expectedLossPL) >
          Math.abs(expectedLossPL) * 0.1);

    const isExtreme = Math.abs(trade.netProfitLoss) > 1000; // Flag trades over $1000

    if (isAnomaly) {
      anomalies++;
      if (isExtreme) {
        extremeAnomalies++;
        logs.push(
          `   ⚠️ EXTREME: Trade #${idx + 1}: ${pointsMoved.toFixed(
            2
          )} points, ` +
            `P&L: $${trade.netProfitLoss.toFixed(2)}, ` +
            `Exit: ${trade.exitReason}`
        );
      }
    }
  });

  if (anomalies > 0) {
    logs.push(
      `   ⚠️ Found ${anomalies} trades with unexpected P&L (${extremeAnomalies} extreme)`
    );
  } else {
    logs.push(`   ✅ All trades match expected P&L values`);
  }

  // Validate daily limits were properly enforced
  const dailyStats = dailyLimitManager.getDailyStats();
  let limitViolations = 0;
  let tradingAfterLimit = 0;

  dailyStats.forEach((day) => {
    // Check if actual P&L exceeded limits
    if (formData.maxDailyLoss && day.actualPnl < -formData.maxDailyLoss) {
      limitViolations++;
      logs.push(
        `   ❌ ${day.date}: Actual P&L $${day.actualPnl.toFixed(
          2
        )} exceeded daily loss limit of $${formData.maxDailyLoss}`
      );
    }
    if (formData.maxDailyProfit && day.actualPnl > formData.maxDailyProfit) {
      limitViolations++;
      logs.push(
        `   ❌ ${day.date}: Actual P&L $${day.actualPnl.toFixed(
          2
        )} exceeded daily profit target of $${formData.maxDailyProfit}`
      );
    }

    // Check if trading continued after hitting limits
    if ((day.hitDailyStop || day.hitDailyTarget) && !day.tradingEnabled) {
      // This is correct - trading was disabled
    } else if ((day.hitDailyStop || day.hitDailyTarget) && day.tradingEnabled) {
      tradingAfterLimit++;
      logs.push(`   ❌ ${day.date}: Trading continued after hitting limit!`);
    }
  });

  if (limitViolations === 0 && tradingAfterLimit === 0) {
    logs.push(`   ✅ All daily limits were properly enforced`);
  } else {
    logs.push(
      `   ❌ Found ${limitViolations} limit violations and ${tradingAfterLimit} days with trading after limits`
    );
  }

  // Add timezone diagnostic for trades
  logs.push(`\n🕐 TIMEZONE DIAGNOSTIC:`);

  // Check a few trades for timezone issues
  trades.slice(0, Math.min(5, trades.length)).forEach((trade, idx) => {
    logs.push(`\nTrade ${idx + 1}:`);
    logs.push(`  Entry: ${trade.entryDate} ${trade.entryTime}`);
    logs.push(`  Exit:  ${trade.exitDate} ${trade.exitTime}`);

    // Check if dates are different
    if (trade.entryDate !== trade.exitDate) {
      logs.push(
        `  ⚠️ DATES DIFFER - Check if this is a timezone issue or overnight hold`
      );
    }
  });

  return {
    count,
    logs,
    statistics: stats,
    trades,
    intradayStats, // Include the intraday stats
  };
}
