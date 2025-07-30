// src/strategy/BarProcessor.ts
import { CsvBar } from '../types/types';
import { streamCsvBars } from '../data/readCSV';
import { fitTrendlinesWindow } from '../analysis/TrendLineAnalysis';
import { SignalGenerator } from '../core/SignalGenerator';
import { ADXCalculator } from '../analysis/ADXCalculator';

export class BarProcessor {
  private cvdWindow: number[] = [];
  private priceWindow: number[] = [];
  private volumeWindow: number[] = [];
  private adxCalculator: ADXCalculator;
  private adxLogCount = 0;
  private barCount = 0; // ADD THIS: Track total bars processed

  constructor(
    private cvdLookBackBars: number,
    private emaMovingAverage?: number,
    private adxThreshold?: number
  ) {
    this.adxCalculator = new ADXCalculator();

    // ADD THIS: Log ADX configuration at startup
    if (this.adxThreshold && this.adxThreshold > 0) {
      console.log(`\n📊 ADX FILTER CONFIGURED:`);
      console.log(`   - ADX Threshold: ${this.adxThreshold}`);
      console.log(`   - ADX Period: 14 (hardcoded)`);
      console.log(`   - ADX will start calculating after ~28 bars\n`);
    }
  }

  async processBars(
    csvFiles: string[],
    start: string,
    end: string,
    processBarCallback: (
      bar: CsvBar,
      prevBar: CsvBar | null,
      isFirstBar: boolean
    ) => void
  ): Promise<{ count: number }> {
    // ADD THIS: Initial ADX diagnostic
    console.log('\n🔍 ADX DIAGNOSTIC CHECK:');
    console.log(
      `   - ADX Threshold configured: ${this.adxThreshold || 'NOT SET'}`
    );
    console.log(
      `   - ADXCalculator initialized: ${this.adxCalculator ? 'YES' : 'NO'}`
    );
    console.log(`   - Starting bar processing...\n`);
    let count = 0;
    let prevBar: CsvBar | null = null;
    let isFirstBar = true;
    let firstAdxFound = false; // Track if we've seen any ADX value

    const filterParams = {
      emaMovingAverage: this.emaMovingAverage,
      adxThreshold: this.adxThreshold,
      cvdLookBackBars: this.cvdLookBackBars,
    };

    for await (const bar of streamCsvBars(csvFiles, start, end, filterParams)) {
      this.barCount++; // Track total bars

      // Calculate ADX for every bar
      const adxResult = this.adxCalculator.update(bar.high, bar.low, bar.close);

      // Override any existing ADX values with our calculated ones
      bar.adx = adxResult.adx;
      bar.plus_di = adxResult.plusDI;
      bar.minus_di = adxResult.minusDI;
      if (!firstAdxFound && count % 10 === 0) {
        console.log(`   📊 Bar ${count}: ADX calculation result:`, {
          adx: adxResult.adx?.toFixed(2) || 'undefined',
          plusDI: adxResult.plusDI?.toFixed(2) || 'undefined',
          minusDI: adxResult.minusDI?.toFixed(2) || 'undefined',
        });

        if (adxResult.adx !== undefined) {
          firstAdxFound = true;
          console.log(
            `   ✅ FIRST ADX VALUE FOUND at bar ${count}: ${adxResult.adx.toFixed(
              2
            )}\n`
          );
        }
      }
      // ADD THIS: Enhanced ADX logging
      if (bar.adx !== undefined && this.adxLogCount < 5) {
        console.log(
          `📊 ADX Calculated at bar ${this.barCount}: ${bar.adx.toFixed(
            2
          )} at ${bar.timestamp}`
        );
        this.adxLogCount++;
        if (this.adxLogCount === 5) {
          console.log(
            `   (Further ADX values will not be logged individually)\n`
          );
        }
      } else if (
        bar.adx === undefined &&
        this.barCount % 10 === 0 &&
        this.barCount < 30
      ) {
        console.log(`   ⏳ Bar ${this.barCount}: ADX still calculating...`);
      }

      count++;

      processBarCallback(bar, prevBar, isFirstBar);

      if (!isFirstBar && prevBar) {
        this.updateWindows(prevBar);
      }

      isFirstBar = false;
      prevBar = bar;
    }

    // ADD THIS: Summary at end
    if (this.adxThreshold && this.adxThreshold > 0) {
      console.log(`\n📊 ADX PROCESSING SUMMARY:`);
      console.log(`   - Total bars processed: ${this.barCount}`);
      console.log(
        `   - ADX values calculated: ${this.adxLogCount > 0 ? 'YES' : 'NO'}`
      );
    }

    return { count };
  }

  generateSignal(
    bar: CsvBar,
    prevBar: CsvBar | null,
    lastSignal: 'bullish' | 'bearish' | null,
    signalGenerator: SignalGenerator
  ): 'bullish' | 'bearish' | 'none' {
    if (this.cvdWindow.length < this.cvdLookBackBars) {
      return 'none';
    }

    const trendlines = fitTrendlinesWindow(this.cvdWindow);
    let signal = trendlines.breakout;

    // Get indicator values
    const emaValue = this.emaMovingAverage
      ? (bar[`ema_${this.emaMovingAverage}` as keyof CsvBar] as number)
      : undefined;
    const prevEmaValue =
      this.emaMovingAverage && prevBar
        ? (prevBar[`ema_${this.emaMovingAverage}` as keyof CsvBar] as number)
        : undefined;
    const adxValue = bar.adx;

    // Add logging to debug
    if (signal !== 'none') {
      console.log(`    → Initial signal: ${signal}`);
      console.log(
        `    → Bar data - Price: ${bar.close}, EMA${this.emaMovingAverage}: ${
          emaValue?.toFixed(2) || 'N/A'
        }, ADX(14): ${adxValue?.toFixed(2) || 'calculating...'}`
      );

      // Enhanced ADX debug when we have a signal and ADX threshold
      if (this.adxThreshold && this.adxThreshold > 0) {
        console.log(`    → ADX Filter Check:`);
        console.log(
          `      • Current ADX: ${adxValue?.toFixed(2) || 'undefined'}`
        );
        console.log(`      • ADX Threshold: ${this.adxThreshold}`);
        if (adxValue === undefined) {
          console.log(
            `      • Result: ADX still calculating (bar ${this.barCount}, needs ~28 bars)`
          );
        } else {
          console.log(
            `      • Result: ADX ${
              adxValue > this.adxThreshold ? 'PASSES ✓' : 'FAILS ✗'
            }`
          );
        }
      }
    }

    // Validate signal with all filters including new indicator checks
    signal = signalGenerator.validateSignal(signal, trendlines, {
      lastSignal,
      priceWindow: this.priceWindow,
      volumeWindow: this.volumeWindow,
      bar,
      prevBar,
      emaValue,
      prevEmaValue,
      adxValue,
      adxThreshold: this.adxThreshold,
    });

    return signal;
  }

  private updateWindows(bar: CsvBar): void {
    this.cvdWindow.push(bar.cvd_close || 0);
    this.priceWindow.push(bar.close);
    this.volumeWindow.push(bar.volume);

    // Maintain window size
    if (this.cvdWindow.length > this.cvdLookBackBars) {
      this.cvdWindow.shift();
      this.priceWindow.shift();
      this.volumeWindow.shift();
    }
  }
}
