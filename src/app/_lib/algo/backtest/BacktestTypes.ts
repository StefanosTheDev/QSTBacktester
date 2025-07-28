// src/strategy/BacktestTypes.ts
import { CsvBar } from '../types/types';
import { TradeRecord } from '../trading/PositionTypes';

export interface BacktestResult {
  count: number;
  logs: string[];
  statistics: {
    totalTrades: number;
    winRate: number;
    averageProfit: number;
    sharpeRatio: number;
    dailyPnL: Record<string, number>;
    maxDrawdown?: number;
    consecutiveStats?: { maxWins: number; maxLosses: number };
    profitFactor?: number;
    totalProfit?: number;
    avgWinLoss?: {
      avgWin: number;
      avgLoss: number;
      avgWinPoints: number;
      avgLossPoints: number;
    };
    daysHitStop?: number;
    daysHitTarget?: number;
    totalTradingDays?: number;
    actualTotalProfit?: number;
    actualDailyPnL?: Record<string, number>;
    longShortStats?: {
      longTrades: number;
      longWins: number;
      longLosses: number;
      longWinRate: number;
      shortTrades: number;
      shortWins: number;
      shortLosses: number;
      shortWinRate: number;
      longAvgProfit: number;
      shortAvgProfit: number;
    };
  };
  trades: TradeRecord[];
  intradayStats?: Record<string, IntradayStats>;
}

export interface IntradayStats {
  date: string;
  maxHigh: number;
  maxLow: number;
  finalPnL: number;
  trades: number;
}

export interface PendingSignal {
  type: 'bullish' | 'bearish';
  signalBar: CsvBar;
  entryPrice?: number;
}
