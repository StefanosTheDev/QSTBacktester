// src/strategy/trading/PositionTypes.ts

export interface Position {
  type: 'bullish' | 'bearish';
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  timestamp: string;
}

export interface ExtendedPosition extends Position {
  initialStopPrice: number;
  highestProfit: number;
  stopMovedToBreakeven: boolean;
  isTrailing: boolean;
}

export interface TrailingStopConfig {
  enabled: boolean;
  breakevenTrigger: number;
  trailDistance: number;
}

export interface ExitResult {
  exited: boolean;
  reason?: string;
  profit?: number;
  exitPrice?: number;
  tradeRecord?: TradeRecord;
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

// ES Mini futures constants
export const FUTURES_CONSTANTS = {
  TICK_SIZE: 0.25,
  TICK_VALUE: 12.5, // $12.50 per tick
  COMMISSION_PER_CONTRACT: 2.5, // Round trip commission
  MAX_SLIPPAGE_TICKS: 1, // Maximum 1 tick of slippage
} as const;
