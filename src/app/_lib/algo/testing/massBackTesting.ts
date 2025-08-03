// src/app/_lib/algo/testing/massBacktestQuick.ts
import { ApiParams } from '../types/types';
import { runBacktest } from '../backtest/runBacktest';
import { selectCSV } from '../analysis/Calculations';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

interface TestResult {
  // Parameters
  cvdLookback: number;
  adxThreshold: number;
  stopLoss: number;
  takeProfit: number;
  rrRatio: string;
  emaFilter: number;
  smaFilter: number;
  useVWAP: boolean;
  timeWindow: string;
  useTrailingStop: boolean;

  // Results
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  totalPnL: number;
  avgWin: number;
  avgLoss: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxConsecWins: number;
  maxConsecLosses: number;
  totalBars: number;
  executionTimeMs: number;

  // Long/Short breakdown
  longTrades: number;
  longWinRate: number;
  shortTrades: number;
  shortWinRate: number;
}

// QUICK TEST PARAMETERS - Runs in 5 minutes!
const PARAM_GRID = {
  // Test 3 most important CVD values
  cvdLookbackBars: [5, 8, 10],

  // Test with and without ADX
  adxThreshold: [0, 25],

  // Test 3 best R:R ratios
  riskRewardCombos: [
    { sl: 10, tp: 20 }, // 1:2 (balanced)
    { sl: 10, tp: 25 }, // 1:2.5 (aggressive)
    { sl: 12, tp: 18 }, // 1:1.5 (conservative)
  ],

  // Test most important filter
  emaFilters: [0, 21],
  smaFilters: [0], // Skip for now
  useVWAP: [false], // Skip for now

  // Test 2 most important time windows
  timeWindows: [
    { name: 'Morning', start: '06:30', end: '08:00' }, // Best historical performance
    { name: 'FullDay', start: '06:30', end: '13:00' }, // Baseline comparison
  ],

  useTrailingStop: [false], // Skip for now

  // Fixed parameters
  fixed: {
    startDate: '2025-03-01', // Just March for faster testing
    endDate: '2025-03-31',
    barType: 'time' as const,
    barSize: 1,
    candleType: 'traditional' as const,
    contractSize: 1,
    maxDailyLoss: 1500,
    maxDailyProfit: 3000,
    breakevenTrigger: 3,
    trailDistance: 2,
  },
};

// Calculate total combinations
function calculateTotalCombinations(): number {
  return (
    PARAM_GRID.cvdLookbackBars.length *
    PARAM_GRID.adxThreshold.length *
    PARAM_GRID.riskRewardCombos.length *
    PARAM_GRID.emaFilters.length *
    PARAM_GRID.smaFilters.length *
    PARAM_GRID.useVWAP.length *
    PARAM_GRID.timeWindows.length *
    PARAM_GRID.useTrailingStop.length
  );
}

// Generate all combinations
function* generateCombinations() {
  for (const cvd of PARAM_GRID.cvdLookbackBars) {
    for (const adx of PARAM_GRID.adxThreshold) {
      for (const rr of PARAM_GRID.riskRewardCombos) {
        for (const ema of PARAM_GRID.emaFilters) {
          for (const sma of PARAM_GRID.smaFilters) {
            for (const vwap of PARAM_GRID.useVWAP) {
              for (const timeWindow of PARAM_GRID.timeWindows) {
                for (const trailing of PARAM_GRID.useTrailingStop) {
                  yield {
                    cvdLookBackBars: cvd,
                    adxThreshold: adx,
                    stopLoss: rr.sl,
                    takeProfit: rr.tp,
                    emaMovingAverage: ema,
                    smaFilter: sma,
                    useVWAP: vwap,
                    timeWindow: timeWindow,
                    useTrailingStop: trailing,
                  };
                }
              }
            }
          }
        }
      }
    }
  }
}

// Run single backtest
async function runSingleBacktest(params: any): Promise<TestResult | null> {
  const startTime = Date.now();

  try {
    // Build full API params
    const apiParams: ApiParams = {
      ...PARAM_GRID.fixed,
      start: `${PARAM_GRID.fixed.startDate} ${params.timeWindow.start}:00 AM`,
      end: `${PARAM_GRID.fixed.endDate} ${params.timeWindow.end}:00 PM`,
      cvdLookBackBars: params.cvdLookBackBars,
      adxThreshold: params.adxThreshold,
      adxPeriod: 14,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
      emaMovingAverage: params.emaMovingAverage || undefined,
      smaFilter: params.smaFilter || undefined,
      useVWAP: params.useVWAP,
      useTrailingStop: params.useTrailingStop,
      breakevenTrigger: PARAM_GRID.fixed.breakevenTrigger,
      trailDistance: PARAM_GRID.fixed.trailDistance,
      maxDailyLoss: PARAM_GRID.fixed.maxDailyLoss,
      maxDailyProfit: PARAM_GRID.fixed.maxDailyProfit,
    };

    // Get CSV files
    const csvList = selectCSV(
      apiParams.barType,
      apiParams.candleType,
      apiParams.start,
      apiParams.end
    );

    // Run backtest
    const result = await runBacktest(csvList, apiParams);

    // Extract results
    const stats = result.statistics;
    const rrRatio = `1:${(params.takeProfit / params.stopLoss).toFixed(2)}`;

    return {
      // Parameters
      cvdLookback: params.cvdLookBackBars,
      adxThreshold: params.adxThreshold,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
      rrRatio: rrRatio,
      emaFilter: params.emaMovingAverage,
      smaFilter: params.smaFilter,
      useVWAP: params.useVWAP,
      timeWindow: params.timeWindow.name,
      useTrailingStop: params.useTrailingStop,

      // Results
      totalTrades: stats.totalTrades,
      winRate: parseFloat(stats.winRate.toFixed(2)),
      profitFactor: parseFloat((stats.profitFactor || 0).toFixed(2)),
      totalPnL: parseFloat((stats.totalProfit || 0).toFixed(2)),
      avgWin: parseFloat((stats.avgWinLoss?.avgWin || 0).toFixed(2)),
      avgLoss: parseFloat((stats.avgWinLoss?.avgLoss || 0).toFixed(2)),
      sharpeRatio: parseFloat(stats.sharpeRatio.toFixed(2)),
      maxDrawdown: parseFloat((stats.maxDrawdown || 0).toFixed(2)),
      maxConsecWins: stats.consecutiveStats?.maxWins || 0,
      maxConsecLosses: stats.consecutiveStats?.maxLosses || 0,
      totalBars: result.count,
      executionTimeMs: Date.now() - startTime,

      // Long/Short breakdown
      longTrades: stats.longShortStats?.longTrades || 0,
      longWinRate: parseFloat(
        (stats.longShortStats?.longWinRate || 0).toFixed(2)
      ),
      shortTrades: stats.longShortStats?.shortTrades || 0,
      shortWinRate: parseFloat(
        (stats.longShortStats?.shortWinRate || 0).toFixed(2)
      ),
    };
  } catch (error) {
    console.error(`Error in backtest:`, error);
    return null;
  }
}

// Save results to CSV
function saveResultsToCSV(results: TestResult[], filename: string) {
  // Create CSV header
  const headers = [
    'CVD_Lookback',
    'ADX_Threshold',
    'Stop_Loss',
    'Take_Profit',
    'RR_Ratio',
    'EMA_Filter',
    'SMA_Filter',
    'Use_VWAP',
    'Time_Window',
    'Trailing_Stop',
    'Total_Trades',
    'Win_Rate',
    'Profit_Factor',
    'Total_PnL',
    'Avg_Win',
    'Avg_Loss',
    'Sharpe_Ratio',
    'Max_Drawdown',
    'Max_Consec_Wins',
    'Max_Consec_Losses',
    'Long_Trades',
    'Long_Win_Rate',
    'Short_Trades',
    'Short_Win_Rate',
    'Total_Bars',
    'Execution_Time_Ms',
  ].join(',');

  // Create CSV rows
  const rows = results.map((r) =>
    [
      r.cvdLookback,
      r.adxThreshold,
      r.stopLoss,
      r.takeProfit,
      r.rrRatio,
      r.emaFilter,
      r.smaFilter,
      r.useVWAP,
      r.timeWindow,
      r.useTrailingStop,
      r.totalTrades,
      r.winRate,
      r.profitFactor,
      r.totalPnL,
      r.avgWin,
      r.avgLoss,
      r.sharpeRatio,
      r.maxDrawdown,
      r.maxConsecWins,
      r.maxConsecLosses,
      r.longTrades,
      r.longWinRate,
      r.shortTrades,
      r.shortWinRate,
      r.totalBars,
      r.executionTimeMs,
    ].join(',')
  );

  const csv = [headers, ...rows].join('\n');

  // Save to file
  const outputPath = path.join(process.cwd(), filename);
  fs.writeFileSync(outputPath, csv);

  console.log(`\n💾 Results saved to: ${outputPath}`);
}

// Main execution function
export async function runMassBacktest() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║            QUICK PARAMETER TEST - 5 MINUTES               ║
╚═══════════════════════════════════════════════════════════╝
  `);

  const totalCombos = calculateTotalCombinations();
  console.log(`📊 Total combinations to test: ${totalCombos}`);
  console.log(
    `⏱️  Estimated time: ${((totalCombos * 2) / 60).toFixed(1)} minutes`
  );
  console.log(
    `📅 Date range: ${PARAM_GRID.fixed.startDate} to ${PARAM_GRID.fixed.endDate}`
  );
  console.log(`\n🎯 Testing:`);
  console.log(`   - CVD Lookback: ${PARAM_GRID.cvdLookbackBars.join(', ')}`);
  console.log(`   - ADX Threshold: ${PARAM_GRID.adxThreshold.join(', ')}`);
  console.log(
    `   - Risk/Reward Ratios: ${PARAM_GRID.riskRewardCombos.length} combinations`
  );
  console.log(
    `   - Time Windows: ${PARAM_GRID.timeWindows.map((t) => t.name).join(', ')}`
  );
  console.log('\nStarting in 3 seconds... (Ctrl+C to cancel)\n');

  await new Promise((resolve) => setTimeout(resolve, 3000));

  const results: TestResult[] = [];
  const startTime = Date.now();
  let completed = 0;
  let failed = 0;

  // Process all combinations
  for (const params of generateCombinations()) {
    const result = await runSingleBacktest(params);

    if (result) {
      results.push(result);
    } else {
      failed++;
    }

    completed++;

    // Progress update
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = completed / elapsed;
    const remaining = (totalCombos - completed) / rate;
    const pct = ((completed / totalCombos) * 100).toFixed(1);

    console.log(
      `[${new Date().toLocaleTimeString()}] Progress: ${completed}/${totalCombos} (${pct}%) | ` +
        `ETA: ${remaining.toFixed(0)}s | Rate: ${rate.toFixed(1)}/sec`
    );
  }

  // Final statistics
  const totalTime = (Date.now() - startTime) / 1000;
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    BACKTEST COMPLETE                      ║
╚═══════════════════════════════════════════════════════════╝

📊 Total tests run: ${completed}
✅ Successful: ${results.length}
❌ Failed: ${failed}
⏱️  Total time: ${(totalTime / 60).toFixed(1)} minutes
🚀 Tests per second: ${(completed / totalTime).toFixed(1)}
  `);

  // Find top performers
  const topByPF = [...results]
    .filter((r) => r.totalTrades >= 10) // Minimum trades for reliability
    .sort((a, b) => b.profitFactor - a.profitFactor)
    .slice(0, 10);

  const topByPnL = [...results]
    .filter((r) => r.totalTrades >= 10)
    .sort((a, b) => b.totalPnL - a.totalPnL)
    .slice(0, 10);

  console.log('\n🏆 TOP 10 BY PROFIT FACTOR:');
  console.log(
    '═══════════════════════════════════════════════════════════════'
  );
  topByPF.forEach((r, i) => {
    console.log(
      `${i + 1}. PF: ${r.profitFactor} | Win%: ${r.winRate}% | P&L: $${
        r.totalPnL
      } | ` +
        `Trades: ${r.totalTrades} | CVD: ${r.cvdLookback} | ADX: ${r.adxThreshold} | ` +
        `SL/TP: ${r.stopLoss}/${r.takeProfit} | EMA: ${r.emaFilter} | Time: ${r.timeWindow}`
    );
  });

  console.log('\n💰 TOP 10 BY TOTAL P&L:');
  console.log(
    '═══════════════════════════════════════════════════════════════'
  );
  topByPnL.forEach((r, i) => {
    console.log(
      `${i + 1}. P&L: $${r.totalPnL} | PF: ${r.profitFactor} | Win%: ${
        r.winRate
      }% | ` +
        `Trades: ${r.totalTrades} | CVD: ${r.cvdLookback} | ADX: ${r.adxThreshold} | ` +
        `SL/TP: ${r.stopLoss}/${r.takeProfit} | EMA: ${r.emaFilter} | Time: ${r.timeWindow}`
    );
  });

  // Best settings summary
  if (topByPF.length > 0) {
    const best = topByPF[0];
    console.log('\n');
    console.log(
      '╔═══════════════════════════════════════════════════════════════╗'
    );
    console.log(
      '║                    RECOMMENDED SETTINGS                       ║'
    );
    console.log(
      '╚═══════════════════════════════════════════════════════════════╝'
    );
    console.log(`\n🎯 OPTIMAL CONFIGURATION:`);
    console.log(`   - CVD Lookback: ${best.cvdLookback} bars`);
    console.log(`   - ADX Threshold: ${best.adxThreshold}`);
    console.log(`   - Stop Loss: ${best.stopLoss} points`);
    console.log(
      `   - Take Profit: ${best.takeProfit} points (${best.rrRatio})`
    );
    console.log(
      `   - EMA Filter: ${best.emaFilter === 0 ? 'Disabled' : best.emaFilter}`
    );
    console.log(`   - Time Window: ${best.timeWindow}`);
    console.log(`\n📈 EXPECTED PERFORMANCE:`);
    console.log(`   - Win Rate: ${best.winRate}%`);
    console.log(`   - Profit Factor: ${best.profitFactor}`);
    console.log(
      `   - Average per Trade: $${(best.totalPnL / best.totalTrades).toFixed(
        2
      )}`
    );
    console.log(`   - Long Win Rate: ${best.longWinRate}%`);
    console.log(`   - Short Win Rate: ${best.shortWinRate}%`);
  }

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `quick_backtest_results_${timestamp}.csv`;
  saveResultsToCSV(results, filename);

  // Also save as JSON
  const jsonFilename = filename.replace('.csv', '.json');
  fs.writeFileSync(
    path.join(process.cwd(), jsonFilename),
    JSON.stringify(results, null, 2)
  );

  console.log(`\n📄 Full results saved to: ${filename}`);
  console.log(`📄 JSON data saved to: ${jsonFilename}`);

  // Next steps
  console.log('\n');
  console.log(
    '╔═══════════════════════════════════════════════════════════════╗'
  );
  console.log(
    '║                         NEXT STEPS                            ║'
  );
  console.log(
    '╚═══════════════════════════════════════════════════════════════╝'
  );
  console.log('\n1. Review the CSV file for detailed analysis');
  console.log('2. Test the top configuration on different months');
  console.log('3. Consider running a deeper test on the winning parameters');
  console.log('4. Implement the optimal settings in your live strategy\n');
}

// Run if called directly
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  runMassBacktest().catch(console.error);
}
