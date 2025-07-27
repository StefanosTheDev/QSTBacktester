// src/strategy/SignalGenerator.ts
import { CsvBar, TrendlineResult } from './types';

export class SignalGenerator {
  validateSignal(
    signal: 'bullish' | 'bearish' | 'none',
    trendlines: TrendlineResult,
    filters: {
      lastSignal: 'bullish' | 'bearish' | null;
      priceWindow: number[];
      volumeWindow: number[];
      bar: CsvBar;
      prevBar: CsvBar | null;
      emaValue?: number;
      prevEmaValue?: number;
      adxValue?: number;
      adxThreshold?: number;
    }
  ): 'bullish' | 'bearish' | 'none' {
    if (signal === 'none') return 'none';

    const { supSlope, resSlope } = trendlines;
    const {
      lastSignal,
      priceWindow,
      volumeWindow,
      bar,
      prevBar, // eslint-disable-line @typescript-eslint/no-unused-vars
      emaValue,
      prevEmaValue, // eslint-disable-line @typescript-eslint/no-unused-vars
      adxValue,
      adxThreshold,
    } = filters;

    // 1. Reversal filter - wait for opposite signal
    if (signal === lastSignal) {
      console.log(`    → filtered: waiting for reversal from ${lastSignal}`);
      return 'none';
    }

    // 2. Slope filters - trend must be in right direction
    if (signal === 'bullish' && resSlope <= 0) {
      console.log('    → filtered: resistance slope not positive');
      return 'none';
    }
    if (signal === 'bearish' && supSlope >= 0) {
      console.log('    → filtered: support slope not negative');
      return 'none';
    }

    // 3. Price confirmation - breakout must be genuine
    const prevPrices = priceWindow.slice(0, -1);
    if (signal === 'bullish' && bar.close <= Math.max(...prevPrices)) {
      console.log('    → filtered: price did not exceed recent highs');
      return 'none';
    }
    if (signal === 'bearish' && bar.close >= Math.min(...prevPrices)) {
      console.log('    → filtered: price did not drop below recent lows');
      return 'none';
    }

    // 4. Volume confirmation - need volume on breakout
    const avgVol =
      volumeWindow.slice(0, -1).reduce((a, b) => a + b, 0) /
      (volumeWindow.length - 1);
    if (bar.volume <= avgVol) {
      console.log('    → filtered: volume below recent average');
      return 'none';
    }

    // 5. EMA filter - proper implementation
    if (emaValue !== undefined) {
      // For bullish signals, price should be above EMA
      if (signal === 'bullish' && bar.close < emaValue) {
        console.log(
          `    → filtered: bullish signal but price ${bar.close.toFixed(
            2
          )} below EMA ${emaValue.toFixed(2)}`
        );
        return 'none';
      }
      // For bearish signals, price should be below EMA
      if (signal === 'bearish' && bar.close > emaValue) {
        console.log(
          `    → filtered: bearish signal but price ${bar.close.toFixed(
            2
          )} above EMA ${emaValue.toFixed(2)}`
        );
        return 'none';
      }
      console.log(
        `    → EMA filter passed: price ${bar.close.toFixed(
          2
        )} vs EMA ${emaValue.toFixed(2)}`
      );
    }

    // 6. ADX filter with directional movement
    if (adxThreshold && adxValue !== undefined) {
      // First check if trend is strong enough
      if (adxValue < adxThreshold) {
        console.log(
          `    → filtered by ADX strength: ${adxValue.toFixed(
            2
          )} < ${adxThreshold}`
        );
        return 'none';
      }

      // Then check if direction matches using DI values
      if (bar.plus_di !== undefined && bar.minus_di !== undefined) {
        if (signal === 'bullish' && bar.plus_di < bar.minus_di) {
          console.log(
            `    → filtered by ADX direction: +DI ${bar.plus_di.toFixed(
              2
            )} < -DI ${bar.minus_di.toFixed(2)} for bullish signal`
          );
          return 'none';
        }
        if (signal === 'bearish' && bar.minus_di < bar.plus_di) {
          console.log(
            `    → filtered by ADX direction: -DI ${bar.minus_di.toFixed(
              2
            )} < +DI ${bar.plus_di.toFixed(2)} for bearish signal`
          );
          return 'none';
        }
        console.log(
          `    → ADX passed: ADX=${adxValue.toFixed(
            2
          )}, +DI=${bar.plus_di.toFixed(2)}, -DI=${bar.minus_di.toFixed(2)}`
        );
      }
    }

    // 7. CVD color confirmation (if available)
    if (bar.cvd_color) {
      if (signal === 'bullish' && bar.cvd_color === 'red') {
        console.log(
          '    → filtered: bullish signal but CVD showing selling (red)'
        );
        return 'none';
      }
      if (signal === 'bearish' && bar.cvd_color === 'green') {
        console.log(
          '    → filtered: bearish signal but CVD showing buying (green)'
        );
        return 'none';
      }
    }

    console.log(`    ✓ Signal validated: ${signal.toUpperCase()}`);
    return signal;
  }
}
