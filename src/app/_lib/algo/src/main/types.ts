/**
 * Completed backtest trade record
 */
export interface StrategyTrade {
  type: 'bullish' | 'bearish';
  entryPrice: number;
  exitPrice: number;
  profit: number;
  entryTime: string;
  exitTime: string;
  reason: string;
  winLoss: 'W' | 'L';
}

/**
 * Single bar with all precomputed indicators from the CSV
 */
export interface CsvBar {
  // always present
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  delta: number;

  // CVD fields
  cvd_open?: number;
  cvd_high?: number;
  cvd_low?: number;
  cvd_close?: number;
  cvd_color?: string; // ← ADD THIS

  // ADX/DI fields
  plus_di?: number; // ← ADD THIS (+di from CSV)
  minus_di?: number; // ← ADD THIS (-di from CSV)
  dx?: number; // ← ADD THIS
  adx?: number; // ← ADD THIS
  adxr?: number; // ← ADD THIS

  // EMA fields
  ema_8?: number;
  ema_9?: number;
  ema_13?: number;
  ema_21?: number;
  ema_22?: number;
  ema_50?: number;
  ema_100?: number;
  ema_200?: number;
}

/**
 * Parameters passed from the frontend to configure the CSV backtest
 */
export interface ApiParams {
  start: string;
  end: string;

  // Simplified bar settings
  barType: 'time' | 'tick';
  barSize: number;
  candleType: 'traditional' | 'heikinashi';
  cvdLookBackBars?: number;

  // Indicator Settings
  emaMovingAverage?: number;
  adxThreshold?: number;
  adxPeriod?: number;

  // Risk Management
  contractSize: number;
  stopLoss: number;
  takeProfit: number;
  maxDailyLoss?: number;
  maxDailyProfit?: number;
}

export interface Position {
  type: 'bullish' | 'bearish';
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  timestamp: string;
}

export interface TrendlineResult {
  supportLine: number[];
  resistLine: number[];
  supSlope: number;
  resSlope: number;
  breakout: 'bullish' | 'bearish' | 'none';
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
