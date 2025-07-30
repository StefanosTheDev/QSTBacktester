// src/types/types.ts
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
  cvd_color?: string;

  // ADX/DI fields
  plus_di?: number;
  minus_di?: number;
  dx?: number;
  adx?: number;
  adxr?: number;

  // EMA fields
  ema_8?: number;
  ema_9?: number;
  ema_13?: number;
  ema_21?: number;
  ema_22?: number;
  ema_50?: number;
  ema_100?: number;
  ema_200?: number;

  // SMA fields - NEW
  sma_50?: number;
  sma_100?: number;
  sma_200?: number;

  // VWAP - NEW
  vwap?: number;
}

export interface ApiParams {
  start: string;
  end: string;

  // Simplified bar settings
  barType: 'time' | 'tick';
  barSize: number;
  candleType: 'traditional' | 'heikinashi';
  cvdLookBackBars?: number;

  // Indicator Settings - Keep existing fields
  emaMovingAverage?: number;
  adxThreshold?: number;
  adxPeriod?: number;

  // NEW - SMA and VWAP filters
  smaFilter?: number; // Can be 50, 100, or 200
  useVWAP?: boolean;

  // Risk Management
  contractSize: number;
  stopLoss: number;
  takeProfit: number;
  maxDailyLoss?: number;
  maxDailyProfit?: number;

  // Trailing Stop Settings
  useTrailingStop?: boolean;
  breakevenTrigger?: number;
  trailDistance?: number;
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

// Form interface for the frontend
export interface FormProp {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  timeframe: string;

  barType: 'time' | 'tick';
  barSize: number;
  candleType: 'traditional' | 'heikinashi';
  cvdLookBackBars: number;

  emaMovingAverage: number;
  adxThreshold: number;
  adxPeriod: number;

  // NEW - SMA and VWAP filters
  smaFilter: number; // 0 = off, 50/100/200 = on with that value
  useVWAP: boolean;

  contractSize: number;
  stopLoss: number;
  takeProfit: number;

  maxDailyLoss: number;
  maxDailyProfit: number;

  useTrailingStop: boolean;
  breakevenTrigger: number;
  trailDistance: number;
}
