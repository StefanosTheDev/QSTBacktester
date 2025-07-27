// src/indicators/TrendlineAnalysis.ts
import { TrendlineResult } from './types';

import { calculateLinearRegression } from './Calculations';

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

  // Simple optimization parameters
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

export function fitTrendlinesWindow(
  y: number[],
  tolerance: number = 0.001
): TrendlineResult {
  const N = y.length;
  const x = Array.from({ length: N }, (_, i) => i);

  const { slope, residuals } = calculateLinearRegression(y);

  const upPiv = residuals.indexOf(Math.max(...residuals));
  const loPiv = residuals.indexOf(Math.min(...residuals));

  const [supSlope, supInt] = optimizeSlope(true, loPiv, slope, y);
  const [resSlope, resInt] = optimizeSlope(false, upPiv, slope, y);

  const supportLine = x.map((i) => supSlope * i + supInt);
  const resistLine = x.map((i) => resSlope * i + resInt);

  const last = y[N - 1];
  const tol = Math.abs(resistLine[N - 1]) * tolerance;

  const breakout =
    last >= resistLine[N - 1] - tol
      ? 'bullish'
      : last <= supportLine[N - 1] + tol
      ? 'bearish'
      : 'none';

  return { supportLine, resistLine, supSlope, resSlope, breakout };
}
