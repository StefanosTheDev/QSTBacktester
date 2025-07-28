// src/strategy/runBacktest.ts
import { ApiParams } from '../types/types';
import { BacktestEngine } from './BacktestEngine';
import { BacktestResult } from './BacktestTypes';

/**
 * Main entry point for running backtests
 * Replaces the old run() function from csvMain.ts
 */
export async function runBacktest(
  csvFiles: string[],
  formData: ApiParams
): Promise<BacktestResult> {
  const engine = new BacktestEngine(formData);
  return await engine.run(csvFiles);
}
