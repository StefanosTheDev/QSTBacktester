// In your types/types.ts file, update the FormProp interface:

export interface FormProp {
  useVWAP: boolean | undefined;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  timeframe: string;

  // Simplified bar settings
  barType: 'time' | 'tick';
  barSize: number;
  candleType: 'traditional' | 'heikinashi';
  cvdLookBackBars?: number;

  // Indicator Settings
  emaMovingAverage?: number;
  adxThreshold?: number;
  adxPeriod?: number;
  smaFilter: number;

  // Risk Management
  contractSize: number;
  stopLoss: number;
  takeProfit: number;
  // Daily limits
  maxDailyLoss?: number;
  maxDailyProfit?: number;

  // Trailing Stop Settings
  useTrailingStop?: boolean;
  breakevenTrigger?: number;
  trailDistance?: number;
}
