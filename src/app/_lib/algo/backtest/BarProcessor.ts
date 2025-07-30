// src/strategy/BarProcessor.ts
import { CsvBar } from '../types/types';
import { streamCsvBars } from '../data/readCSV';
import { fitTrendlinesWindow } from '../analysis/TrendLineAnalysis';
import { SignalGenerator } from '../core/SignalGenerator';

export class BarProcessor {
  private cvdWindow: number[] = [];
  private priceWindow: number[] = [];
  private volumeWindow: number[] = [];

  constructor(
    private cvdLookBackBars: number,
    private emaMovingAverage?: number,
    private adxThreshold?: number
  ) {}

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
    let count = 0;
    let prevBar: CsvBar | null = null;
    let isFirstBar = true;

    const filterParams = {
      emaMovingAverage: this.emaMovingAverage,
      adxThreshold: this.adxThreshold,
      cvdLookBackBars: this.cvdLookBackBars,
    };

    for await (const bar of streamCsvBars(csvFiles, start, end, filterParams)) {
      count++;

      processBarCallback(bar, prevBar, isFirstBar);

      if (!isFirstBar && prevBar) {
        this.updateWindows(prevBar);
      }

      isFirstBar = false;
      prevBar = bar;
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
        `    → Bar data - Price: ${bar.close}, EMA${this.emaMovingAverage}: ${emaValue}, ADX: ${adxValue}`
      );
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
