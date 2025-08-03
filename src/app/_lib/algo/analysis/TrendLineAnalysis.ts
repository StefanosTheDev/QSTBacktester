// src/indicators/TrendlineAnalysis.ts - ENHANCED VERSION
import { TrendlineResult } from '../types/types';
import { calculateLinearRegression } from './Calculations';

// ADD: New interface for enhanced results
export interface EnhancedTrendlineResult extends TrendlineResult {
  supportTouches: number;
  resistanceTouches: number;
  trendStrength: number; // 0-100 score
  slopeConsistency: boolean;
}

function checkTrendLine(
  support: boolean,
  pivot: number,
  slope: number,
  y: number[]
): number {
  const intercept = -slope * pivot + y[pivot];
  const diffs = y.map((yi, i) => slope * i + intercept - yi);

  if (support && Math.max(...diffs) > 1e-5) return -1;
  if (!support && Math.min(...diffs) < -1e-5) return -1;

  return diffs.reduce((sum, d) => sum + d * d, 0);
}

function optimizeSlope(
  support: boolean,
  pivot: number,
  initSlope: number,
  y: number[]
): [number, number] {
  const slopeUnit = (Math.max(...y) - Math.min(...y)) / y.length;
  let optStep = 1;
  let bestSlope = initSlope;
  let bestErr = checkTrendLine(support, pivot, initSlope, y);
  let derivative = 0;
  let getDerivative = true;

  const maxIters = y.length * 10;
  const maxNoImprove = y.length * 5;
  const minStep = 1e-4;

  let iters = 0;
  let noImprove = 0;

  while (optStep > minStep) {
    iters++;
    if (iters >= maxIters || noImprove >= maxNoImprove) break;

    if (getDerivative) {
      let test = bestSlope + slopeUnit * minStep;
      let errTest = checkTrendLine(support, pivot, test, y);

      if (errTest < 0) {
        test = bestSlope - slopeUnit * minStep;
        errTest = checkTrendLine(support, pivot, test, y);
      }

      derivative = errTest - bestErr;
      getDerivative = false;
    }

    const trial =
      derivative > 0
        ? bestSlope - slopeUnit * optStep
        : bestSlope + slopeUnit * optStep;
    const errTrial = checkTrendLine(support, pivot, trial, y);

    if (errTrial < 0 || errTrial >= bestErr) {
      optStep *= 0.5;
      noImprove++;
    } else {
      bestSlope = trial;
      bestErr = errTrial;
      getDerivative = true;
      noImprove = 0;
    }
  }

  const bestIntercept = -bestSlope * pivot + y[pivot];
  return [bestSlope, bestIntercept];
}

// NEW: Count how many times price touches the trendline
function countTrendlineTouches(
  trendline: number[],
  prices: number[],
  tolerance: number = 0.5 // 0.5% tolerance for "touch"
): number {
  let touches = 0;

  for (let i = 0; i < prices.length; i++) {
    const trendValue = trendline[i];
    const priceValue = prices[i];
    const percentDiff = Math.abs((priceValue - trendValue) / trendValue) * 100;

    if (percentDiff <= tolerance) {
      touches++;
    }
  }

  return touches;
}

// NEW: Calculate trend strength based on multiple factors
function calculateTrendStrength(
  slope: number,
  touches: number,
  totalPoints: number,
  priceRange: number
): number {
  // Normalize slope to price range
  const normalizedSlope = (Math.abs(slope) / priceRange) * 100;

  // Touch ratio (more touches = stronger trend)
  const touchRatio = touches / totalPoints;

  // Slope strength (steeper = stronger, but cap at 5% per bar)
  const slopeStrength = Math.min(normalizedSlope / 5, 1);

  // Combined score (0-100)
  const strength = (touchRatio * 0.6 + slopeStrength * 0.4) * 100;

  return Math.round(strength);
}

// ENHANCED main function
export function fitTrendlinesWindow(
  y: number[],
  tolerance: number = 0.001,
  minTouches: number = 2,
  minStrength: number = 30
): EnhancedTrendlineResult {
  const N = y.length;
  const x = Array.from({ length: N }, (_, i) => i);

  const { slope, residuals } = calculateLinearRegression(y);

  const upPiv = residuals.indexOf(Math.max(...residuals));
  const loPiv = residuals.indexOf(Math.min(...residuals));

  const [supSlope, supInt] = optimizeSlope(true, loPiv, slope, y);
  const [resSlope, resInt] = optimizeSlope(false, upPiv, slope, y);

  const supportLine = x.map((i) => supSlope * i + supInt);
  const resistLine = x.map((i) => resSlope * i + resInt);

  // Count touches for validation
  const supportTouches = countTrendlineTouches(supportLine, y, tolerance * 100);
  const resistanceTouches = countTrendlineTouches(
    resistLine,
    y,
    tolerance * 100
  );

  // Calculate price range for normalization
  const priceRange = Math.max(...y) - Math.min(...y);

  // Calculate trend strength
  const avgTouches = (supportTouches + resistanceTouches) / 2;
  const avgSlope = (Math.abs(supSlope) + Math.abs(resSlope)) / 2;
  const trendStrength = calculateTrendStrength(
    avgSlope,
    avgTouches,
    N,
    priceRange
  );

  // Check slope consistency
  const slopeConsistency = supSlope > 0 && resSlope > 0; // Both upward = bullish channel

  const last = y[N - 1];
  const tol = Math.abs(resistLine[N - 1]) * tolerance;

  // ENHANCED breakout detection with validation
  let breakout: 'bullish' | 'bearish' | 'none' = 'none';

  if (last >= resistLine[N - 1] - tol) {
    // Additional validation for bullish breakout
    if (
      resistanceTouches >= minTouches &&
      trendStrength >= minStrength &&
      resSlope > 0
    ) {
      // Resistance must be rising
      breakout = 'bullish';
      console.log(
        `    → Bullish breakout validated: ${resistanceTouches} touches, ${trendStrength}% strength`
      );
    } else {
      console.log(
        `    → Bullish breakout REJECTED: touches=${resistanceTouches}, strength=${trendStrength}%, slope=${resSlope.toFixed(
          4
        )}`
      );
    }
  } else if (last <= supportLine[N - 1] + tol) {
    // Additional validation for bearish breakout
    if (
      supportTouches >= minTouches &&
      trendStrength >= minStrength &&
      supSlope < 0
    ) {
      // Support must be falling
      breakout = 'bearish';
      console.log(
        `    → Bearish breakout validated: ${supportTouches} touches, ${trendStrength}% strength`
      );
    } else {
      console.log(
        `    → Bearish breakout REJECTED: touches=${supportTouches}, strength=${trendStrength}%, slope=${supSlope.toFixed(
          4
        )}`
      );
    }
  }

  return {
    supportLine,
    resistLine,
    supSlope,
    resSlope,
    breakout,
    supportTouches,
    resistanceTouches,
    trendStrength,
    slopeConsistency,
  };
}
