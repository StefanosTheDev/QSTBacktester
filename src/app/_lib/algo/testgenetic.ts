#!/usr/bin/env node

/**
 * SIMPLE PARAMETER TEST
 *
 * Tests just 5 parameter combinations to verify the backtest system works
 * Place this file in your project root and run with: npx ts-node simpleParamTest.ts
 */

import { ApiParams } from './types/types';
import { runBacktest } from './backtest/runBacktest';
import { selectCSV } from './analysis/Calculations';
// ==================== TEST CONFIGURATION ====================
const TEST_PARAMS = {
  // Fixed parameters for all tests
  fixed: {
    startDate: '2025-01-01',
    endDate: '2025-01-31', // Just January for quick test
    barType: 'time' as const,
    barSize: 1,
    candleType: 'traditional' as const,
    contractSize: 1,
    maxDailyLoss: 1500,
    maxDailyProfit: 3000,
    breakevenTrigger: 3,
    trailDistance: 2,
  },

  // 5 test combinations
  testCombinations: [
    {
      name: 'Baseline',
      cvdLookBackBars: 5,
      stopLoss: 10,
      takeProfit: 20,
      emaMovingAverage: 0,
      adxThreshold: 0,
      startTime: '06:30',
      endTime: '13:00',
      useTrailingStop: false,
      tradeDirection: 'both' as const,
    },
    {
      name: 'Conservative',
      cvdLookBackBars: 8,
      stopLoss: 8,
      takeProfit: 12,
      emaMovingAverage: 21,
      adxThreshold: 25,
      startTime: '06:30',
      endTime: '10:00',
      useTrailingStop: true,
      tradeDirection: 'both' as const,
    },
    {
      name: 'Aggressive',
      cvdLookBackBars: 3,
      stopLoss: 12,
      takeProfit: 24,
      emaMovingAverage: 0,
      adxThreshold: 0,
      startTime: '06:30',
      endTime: '13:00',
      useTrailingStop: false,
      tradeDirection: 'both' as const,
    },
    {
      name: 'LongOnly',
      cvdLookBackBars: 5,
      stopLoss: 10,
      takeProfit: 20,
      emaMovingAverage: 9,
      adxThreshold: 20,
      startTime: '06:30',
      endTime: '11:00',
      useTrailingStop: false,
      tradeDirection: 'long' as const,
    },
    {
      name: 'ShortOnly',
      cvdLookBackBars: 5,
      stopLoss: 10,
      takeProfit: 15,
      emaMovingAverage: 0,
      adxThreshold: 30,
      startTime: '08:00',
      endTime: '13:00',
      useTrailingStop: true,
      tradeDirection: 'short' as const,
    },
  ],
};

// ==================== RESULT TRACKING ====================
interface TestResult {
  name: string;
  params: any;
  success: boolean;
  error?: string;
  results?: {
    totalTrades: number;
    winRate: number;
    profitFactor: number;
    totalPnL: number;
    sharpeRatio: number;
    maxDrawdown: number;
    executionTime: number;
  };
}

// ==================== MAIN TEST FUNCTION ====================
async function runSimpleTest() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           SIMPLE PARAMETER TEST - 5 COMBINATIONS          ║
╚═══════════════════════════════════════════════════════════╝
  `);

  console.log('📋 Test Configuration:');
  console.log(
    `   - Test Period: ${TEST_PARAMS.fixed.startDate} to ${TEST_PARAMS.fixed.endDate}`
  );
  console.log(`   - Number of Tests: ${TEST_PARAMS.testCombinations.length}`);
  console.log(
    `   - Bar Type: ${TEST_PARAMS.fixed.barType} ${TEST_PARAMS.fixed.barSize}min`
  );
  console.log('\n🧪 Test Combinations:');

  TEST_PARAMS.testCombinations.forEach((combo, idx) => {
    console.log(
      `   ${idx + 1}. ${combo.name}: CVD=${combo.cvdLookBackBars}, SL/TP=${
        combo.stopLoss
      }/${combo.takeProfit}, Direction=${combo.tradeDirection}`
    );
  });

  console.log('\nStarting tests...\n');

  const allResults: TestResult[] = [];
  const startTime = Date.now();

  // Run each test
  for (let i = 0; i < TEST_PARAMS.testCombinations.length; i++) {
    const testConfig = TEST_PARAMS.testCombinations[i];
    const testStartTime = Date.now();

    console.log(`\n${'='.repeat(60)}`);
    console.log(
      `Test ${i + 1}/${TEST_PARAMS.testCombinations.length}: ${testConfig.name}`
    );
    console.log(`${'='.repeat(60)}`);

    try {
      // Build API parameters
      const apiParams: ApiParams = {
        ...TEST_PARAMS.fixed,
        start: `${TEST_PARAMS.fixed.startDate} ${testConfig.startTime}:00 AM`,
        end: `${TEST_PARAMS.fixed.endDate} ${testConfig.endTime}:00 PM`,
        cvdLookBackBars: testConfig.cvdLookBackBars,
        stopLoss: testConfig.stopLoss,
        takeProfit: testConfig.takeProfit,
        emaMovingAverage: testConfig.emaMovingAverage || undefined,
        adxThreshold: testConfig.adxThreshold || undefined,
        useTrailingStop: testConfig.useTrailingStop,
        tradeDirection: testConfig.tradeDirection,
        smaFilter: 0,
        useVWAP: false,
      };

      console.log('📊 Parameters:');
      console.log(`   - CVD Lookback: ${testConfig.cvdLookBackBars} bars`);
      console.log(`   - Stop Loss: ${testConfig.stopLoss} points`);
      console.log(
        `   - Take Profit: ${testConfig.takeProfit} points (R:R = 1:${(
          testConfig.takeProfit / testConfig.stopLoss
        ).toFixed(2)})`
      );
      console.log(
        `   - EMA Filter: ${testConfig.emaMovingAverage || 'Disabled'}`
      );
      console.log(
        `   - ADX Threshold: ${testConfig.adxThreshold || 'Disabled'}`
      );
      console.log(
        `   - Time Window: ${testConfig.startTime} - ${testConfig.endTime}`
      );
      console.log(`   - Trade Direction: ${testConfig.tradeDirection}`);
      console.log(
        `   - Trailing Stop: ${
          testConfig.useTrailingStop ? 'Enabled' : 'Disabled'
        }`
      );

      console.log('\n🚀 Running backtest...');

      // Get CSV files
      const csvList = selectCSV(
        apiParams.barType,
        apiParams.candleType,
        apiParams.start,
        apiParams.end
      );

      console.log(`📁 Loading ${csvList.length} CSV file(s)...`);

      // Run the backtest
      const result = await runBacktest(csvList, apiParams);

      const executionTime = (Date.now() - testStartTime) / 1000;

      // Extract key results
      const stats = result.statistics;
      const testResult: TestResult = {
        name: testConfig.name,
        params: testConfig,
        success: true,
        results: {
          totalTrades: stats.totalTrades,
          winRate: parseFloat(stats.winRate.toFixed(2)),
          profitFactor: parseFloat((stats.profitFactor || 0).toFixed(2)),
          totalPnL: parseFloat((stats.totalProfit || 0).toFixed(2)),
          sharpeRatio: parseFloat(stats.sharpeRatio.toFixed(2)),
          maxDrawdown: parseFloat((stats.maxDrawdown || 0).toFixed(2)),
          executionTime: parseFloat(executionTime.toFixed(2)),
        },
      };

      allResults.push(testResult);

      // Display results
      console.log('\n✅ Test Completed Successfully!');
      console.log('📈 Results:');
      console.log(`   - Total Trades: ${stats.totalTrades}`);
      console.log(`   - Win Rate: ${stats.winRate.toFixed(2)}%`);
      console.log(
        `   - Profit Factor: ${(stats.profitFactor || 0).toFixed(2)}`
      );
      console.log(`   - Sharpe Ratio: ${stats.sharpeRatio.toFixed(2)}`);
      console.log(`   - Total P&L: $${(stats.totalProfit || 0).toFixed(2)}`);
      console.log(`   - Max Drawdown: ${(stats.maxDrawdown || 0).toFixed(2)}%`);
      console.log(`   - Execution Time: ${executionTime.toFixed(2)}s`);

      if (stats.longShortStats) {
        console.log('\n📊 Long/Short Breakdown:');
        console.log(
          `   - Long Trades: ${
            stats.longShortStats.longTrades
          } (${stats.longShortStats.longWinRate.toFixed(1)}% win rate)`
        );
        console.log(
          `   - Short Trades: ${
            stats.longShortStats.shortTrades
          } (${stats.longShortStats.shortWinRate.toFixed(1)}% win rate)`
        );
      }
    } catch (error) {
      console.error('\n❌ Test Failed!');
      console.error('Error:', error);

      allResults.push({
        name: testConfig.name,
        params: testConfig,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ==================== FINAL SUMMARY ====================
  const totalTime = (Date.now() - startTime) / 1000;

  console.log(`\n\n${'='.repeat(60)}`);
  console.log('📊 TEST SUMMARY');
  console.log(`${'='.repeat(60)}\n`);

  console.log(`Total Execution Time: ${(totalTime / 60).toFixed(2)} minutes\n`);

  // Display results table
  console.log('Results Table:');
  console.log('-'.repeat(120));
  console.log(
    'Name'.padEnd(15) +
      'Trades'.padEnd(10) +
      'Win%'.padEnd(10) +
      'PF'.padEnd(10) +
      'Sharpe'.padEnd(10) +
      'P&L'.padEnd(15) +
      'MaxDD%'.padEnd(10) +
      'Time(s)'.padEnd(10) +
      'Status'
  );
  console.log('-'.repeat(120));

  allResults.forEach((result) => {
    if (result.success && result.results) {
      const r = result.results;
      console.log(
        result.name.padEnd(15) +
          r.totalTrades.toString().padEnd(10) +
          `${r.winRate}%`.padEnd(10) +
          r.profitFactor.toString().padEnd(10) +
          r.sharpeRatio.toString().padEnd(10) +
          `$${r.totalPnL}`.padEnd(15) +
          `${r.maxDrawdown}%`.padEnd(10) +
          r.executionTime.toString().padEnd(10) +
          '✅'
      );
    } else {
      console.log(
        result.name.padEnd(15) +
          '-'.padEnd(10) +
          '-'.padEnd(10) +
          '-'.padEnd(10) +
          '-'.padEnd(10) +
          '-'.padEnd(15) +
          '-'.padEnd(10) +
          '-'.padEnd(10) +
          `❌ ${result.error?.substring(0, 30)}...`
      );
    }
  });

  console.log('-'.repeat(120));

  // Find best performer
  const successfulResults = allResults.filter((r) => r.success && r.results);
  if (successfulResults.length > 0) {
    const bestByPnL = successfulResults.reduce((best, current) =>
      current.results!.totalPnL > best.results!.totalPnL ? current : best
    );

    const bestBySharpe = successfulResults.reduce((best, current) =>
      current.results!.sharpeRatio > best.results!.sharpeRatio ? current : best
    );

    console.log('\n🏆 Best Performers:');
    console.log(
      `   - Highest P&L: ${bestByPnL.name} ($${bestByPnL.results!.totalPnL})`
    );
    console.log(
      `   - Best Sharpe: ${bestBySharpe.name} (${
        bestBySharpe.results!.sharpeRatio
      })`
    );
  }

  // Save results to file
  const resultsFile = `simple_test_results_${new Date()
    .toISOString()
    .replace(/[:.]/g, '-')}.json`;
  const fs = await import('fs');
  fs.writeFileSync(
    resultsFile,
    JSON.stringify(
      {
        testDate: new Date().toISOString(),
        configuration: TEST_PARAMS,
        results: allResults,
        summary: {
          totalTests: allResults.length,
          successful: allResults.filter((r) => r.success).length,
          failed: allResults.filter((r) => !r.success).length,
          totalExecutionTime: totalTime,
        },
      },
      null,
      2
    )
  );

  console.log(`\n💾 Results saved to: ${resultsFile}`);

  // System check
  console.log('\n🔍 System Check:');
  console.log(
    `   - All tests completed: ${allResults.filter((r) => r.success).length}/${
      TEST_PARAMS.testCombinations.length
    } ✅`
  );
  console.log(
    `   - Average execution time: ${(
      totalTime / TEST_PARAMS.testCombinations.length
    ).toFixed(2)}s per test`
  );
  console.log(
    `   - Backtest engine: ${
      allResults.some((r) => r.success) ? 'Working ✅' : 'Error ❌'
    }`
  );

  if (allResults.every((r) => r.success)) {
    console.log('\n✅ ALL SYSTEMS GO! Ready for full genetic optimization.');
  } else {
    console.log(
      '\n⚠️  Some tests failed. Check errors before running full optimization.'
    );
  }
}

// ==================== ERROR HANDLING ====================
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled rejection:', error);
  process.exit(1);
});

// ==================== RUN THE TEST ====================
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1] === import.meta.filename;

if (isMainModule) {
  console.log('🚀 Starting Simple Parameter Test...\n');
  runSimpleTest()
    .then(() => {
      console.log('\n✅ Test suite completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    });
}
