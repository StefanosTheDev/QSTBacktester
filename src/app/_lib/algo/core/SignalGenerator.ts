// src/core/SignalGenerator.ts
import { CsvBar, TrendlineResult } from '../types/types';

interface IndicatorFilters {
  emaMovingAverage?: number;
  smaFilter?: number;
  useVWAP?: boolean;
}

export class SignalGenerator {
  private indicatorFilters: IndicatorFilters;

  constructor(indicatorFilters: IndicatorFilters = {}) {
    this.indicatorFilters = indicatorFilters;
  }

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
      cvdWindow: number[]; // ADD THIS for momentum check
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
      emaValue, // eslint-disable-line @typescript-eslint/no-unused-vars
      prevEmaValue, // eslint-disable-line @typescript-eslint/no-unused-vars
      adxValue,
      adxThreshold,
      cvdWindow,
    } = filters;
    if (adxThreshold && adxThreshold > 0) {
      console.log(
        `    → ADX Debug: threshold=${adxThreshold}, current ADX=${
          adxValue?.toFixed(2) || 'undefined'
        }`
      );
    }

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

    // 5. Multiple Indicator Filters (EMA, SMA, VWAP)
    const indicatorCheckResult = this.checkMultipleIndicators(bar, signal);
    if (!indicatorCheckResult.passed) {
      console.log(
        `    → filtered by indicator checks: ${indicatorCheckResult.reason}`
      );
      return 'none';
    }

    // 6. ADX filter - only check if above threshold (no directional requirement)
    if (adxThreshold && adxThreshold > 0) {
      // Log what we're checking
      console.log(`    → Checking ADX filter: threshold=${adxThreshold}`);

      if (adxValue === undefined) {
        console.log(
          `    → ADX value is undefined - may still be calculating (needs ${
            14 * 2
          } bars)`
        );
        return 'none';
      }

      if (adxValue < adxThreshold) {
        console.log(
          `    → filtered by ADX strength: ${adxValue.toFixed(
            2
          )} < ${adxThreshold}`
        );
        return 'none';
      }
      console.log(`    → ADX passed: ${adxValue.toFixed(2)} > ${adxThreshold}`);
    }

    // 7. CVD color confirmation - STRICT REQUIREMENT (FIXED)
    // MUST have matching CVD color - NO NEUTRAL
    if (!bar.cvd_color) {
      console.log(
        '    → filtered: CVD color data missing - cannot confirm direction'
      );
      return 'none';
    }

    if (signal === 'bullish') {
      if (bar.cvd_color !== 'green') {
        console.log(
          `    → filtered: LONG signal requires GREEN CVD bar, but got ${bar.cvd_color}`
        );
        return 'none';
      }
      console.log('    → CVD confirmation: GREEN bar for LONG ✓');
    } else if (signal === 'bearish') {
      if (bar.cvd_color !== 'red') {
        console.log(
          `    → filtered: SHORT signal requires RED CVD bar, but got ${bar.cvd_color}`
        );
        return 'none';
      }
      console.log('    → CVD confirmation: RED bar for SHORT ✓');
    }

    // 8. CVD Momentum confirmation - NEW!
    const momentumCheck = this.validateCVDMomentum(signal, cvdWindow);
    if (!momentumCheck.valid) {
      console.log(`    → filtered by CVD momentum: ${momentumCheck.reason}`);
      return 'none';
    }

    console.log(`    ✓ Signal validated: ${signal.toUpperCase()}`);
    return signal;
  }

  // NEW METHOD: CVD Momentum Validation
  private validateCVDMomentum(
    signal: 'bullish' | 'bearish',
    cvdWindow: number[],
    minMomentumRatio: number = 1.5
  ): { valid: boolean; reason?: string } {
    if (cvdWindow.length < 3) {
      return { valid: true }; // Not enough data, skip check
    }

    // Calculate CVD momentum (rate of change)
    const currentBar = cvdWindow.length - 1;
    const prevBar = currentBar - 1;
    const prevPrevBar = currentBar - 2;

    // Current momentum (how fast CVD is moving now)
    const currentMomentum = cvdWindow[currentBar] - cvdWindow[prevBar];

    // Previous momentum (how fast it was moving)
    const previousMomentum = cvdWindow[prevBar] - cvdWindow[prevPrevBar];

    // Average momentum over the window
    let totalMomentum = 0;
    for (let i = 1; i < cvdWindow.length; i++) {
      totalMomentum += Math.abs(cvdWindow[i] - cvdWindow[i - 1]);
    }
    const avgMomentum = totalMomentum / (cvdWindow.length - 1);

    if (signal === 'bullish') {
      // For LONG: CVD must be accelerating upward
      if (currentMomentum <= 0) {
        return {
          valid: false,
          reason: 'CVD momentum negative on bullish breakout',
        };
      }

      // Current momentum should be stronger than previous
      if (currentMomentum < previousMomentum) {
        return {
          valid: false,
          reason: 'CVD momentum decelerating on bullish breakout',
        };
      }

      // Current momentum should be above average
      if (currentMomentum < avgMomentum * minMomentumRatio) {
        return {
          valid: false,
          reason: `CVD momentum too weak: ${currentMomentum.toFixed(2)} < ${(
            avgMomentum * minMomentumRatio
          ).toFixed(2)}`,
        };
      }
    } else {
      // For SHORT: CVD must be accelerating downward
      if (currentMomentum >= 0) {
        return {
          valid: false,
          reason: 'CVD momentum positive on bearish breakout',
        };
      }

      // Current momentum should be stronger (more negative) than previous
      if (currentMomentum > previousMomentum) {
        return {
          valid: false,
          reason: 'CVD momentum decelerating on bearish breakout',
        };
      }

      // Current momentum should be below average (negative)
      if (Math.abs(currentMomentum) < avgMomentum * minMomentumRatio) {
        return {
          valid: false,
          reason: `CVD momentum too weak: ${Math.abs(currentMomentum).toFixed(
            2
          )} < ${(avgMomentum * minMomentumRatio).toFixed(2)}`,
        };
      }
    }

    console.log(
      `    → CVD Momentum validated: current=${currentMomentum.toFixed(
        2
      )}, avg=${avgMomentum.toFixed(2)}`
    );
    return { valid: true };
  }

  private checkMultipleIndicators(
    bar: CsvBar,
    signal: 'bullish' | 'bearish' | 'none'
  ): { passed: boolean; reason?: string } {
    // Early return if no signal
    if (signal === 'none') {
      return { passed: true };
    }

    const checks: {
      name: string;
      value: number | undefined;
      enabled: boolean;
    }[] = [];

    // Add EMA check if configured
    if (this.indicatorFilters.emaMovingAverage) {
      const emaKey =
        `ema_${this.indicatorFilters.emaMovingAverage}` as keyof CsvBar;
      checks.push({
        name: `EMA${this.indicatorFilters.emaMovingAverage}`,
        value: bar[emaKey] as number | undefined,
        enabled: true,
      });
    }

    // Add SMA check if configured
    if (
      this.indicatorFilters.smaFilter &&
      this.indicatorFilters.smaFilter > 0
    ) {
      const smaKey = `sma_${this.indicatorFilters.smaFilter}` as keyof CsvBar;
      checks.push({
        name: `SMA${this.indicatorFilters.smaFilter}`,
        value: bar[smaKey] as number | undefined,
        enabled: true,
      });
    }

    // Add VWAP check if enabled
    if (this.indicatorFilters.useVWAP) {
      checks.push({
        name: 'VWAP',
        value: bar.vwap,
        enabled: true,
      });
    }

    // Filter to only enabled indicators with valid values
    const activeChecks = checks.filter(
      (check) => check.enabled && check.value !== undefined
    );

    // If no indicators are selected, pass the check
    if (activeChecks.length === 0) {
      return { passed: true };
    }

    // Check each active indicator based on signal direction
    const failedChecks: string[] = [];
    const passedChecks: string[] = [];

    for (const check of activeChecks) {
      if (check.value === undefined) continue;

      const priceAbove = bar.close > check.value;

      if (signal === 'bullish') {
        // For LONG: price must be ABOVE indicators
        if (!priceAbove) {
          failedChecks.push(`${check.name}(${check.value.toFixed(2)})`);
        } else {
          passedChecks.push(`${check.name}(${check.value.toFixed(2)})`);
        }
      } else if (signal === 'bearish') {
        // For SHORT: price must be BELOW indicators
        if (priceAbove) {
          failedChecks.push(`${check.name}(${check.value.toFixed(2)})`);
        } else {
          passedChecks.push(`${check.name}(${check.value.toFixed(2)})`);
        }
      }
    }

    // Log the results
    console.log(
      `    → Checking ${activeChecks.length} indicator filter(s) for ${signal} signal:`
    );

    if (signal === 'bullish') {
      if (passedChecks.length > 0) {
        console.log(
          `      ✓ LONG: Price ${bar.close.toFixed(
            2
          )} above: ${passedChecks.join(', ')}`
        );
      }
      if (failedChecks.length > 0) {
        console.log(
          `      ✗ LONG: Price ${bar.close.toFixed(
            2
          )} NOT above: ${failedChecks.join(', ')}`
        );
      }
    } else {
      if (passedChecks.length > 0) {
        console.log(
          `      ✓ SHORT: Price ${bar.close.toFixed(
            2
          )} below: ${passedChecks.join(', ')}`
        );
      }
      if (failedChecks.length > 0) {
        console.log(
          `      ✗ SHORT: Price ${bar.close.toFixed(
            2
          )} NOT below: ${failedChecks.join(', ')}`
        );
      }
    }

    // ALL selected indicators must pass
    if (failedChecks.length > 0) {
      return {
        passed: false,
        reason:
          signal === 'bullish'
            ? `LONG blocked - Price not above ${failedChecks.join(', ')}`
            : `SHORT blocked - Price not below ${failedChecks.join(', ')}`,
      };
    }

    return { passed: true };
  }
}
