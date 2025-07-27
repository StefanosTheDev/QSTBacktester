import { FormProp } from '../types/types';
import { ApiParams } from './algo/src/main/types';
/**
 * Extended form parameters including ISO start/end strings.
 */
export interface FormParams extends FormProp {
  start: string;
  end: string;
}
export function buildParams(input: FormProp): ApiParams {
  const { startDate, startTime, endDate, endTime, ...rest } = input;

  console.log('🔍 DEBUG buildParams - Input:', {
    startDate,
    startTime,
    endDate,
    endTime,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  // Convert to CSV PST format (12-hour with AM/PM)
  const start = toCsvPst(startDate, startTime);
  const end = toCsvPst(endDate, endTime);

  console.log('🔍 DEBUG buildParams - Converted:', {
    start,
    end,
  });

  // Build the API parameters
  const params: ApiParams = {
    start,
    end,
    barType: input.barType,
    barSize: input.barSize,
    candleType: input.candleType,
    contractSize: input.contractSize,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
  };

  // Add optional parameters only if they have values
  if (input.cvdLookBackBars) params.cvdLookBackBars = input.cvdLookBackBars;
  if (input.emaMovingAverage) params.emaMovingAverage = input.emaMovingAverage;
  if (input.adxThreshold) params.adxThreshold = input.adxThreshold;
  if (input.adxPeriod) params.adxPeriod = input.adxPeriod;

  // Daily limits can be 0 (to disable), so always include them
  if (input.maxDailyLoss !== undefined)
    params.maxDailyLoss = input.maxDailyLoss;
  if (input.maxDailyProfit !== undefined)
    params.maxDailyProfit = input.maxDailyProfit;

  // Trailing stop parameters
  if (input.useTrailingStop) {
    params.useTrailingStop = input.useTrailingStop;
    if (input.breakevenTrigger !== undefined)
      params.breakevenTrigger = input.breakevenTrigger;
    if (input.trailDistance !== undefined)
      params.trailDistance = input.trailDistance;
  }

  console.log('🔍 DEBUG buildParams - Final params:', params);

  return params;
}
export function toCsvPst(date: string, time: string): string {
  const [hours, minutes] = time.split(':').map(Number);

  // Convert 24-hour to 12-hour format
  let displayHours: number;
  let ampm: string;

  if (hours === 0) {
    // Midnight
    displayHours = 12;
    ampm = 'AM';
  } else if (hours < 12) {
    // Morning
    displayHours = hours;
    ampm = 'AM';
  } else if (hours === 12) {
    // Noon
    displayHours = 12;
    ampm = 'PM';
  } else {
    // Afternoon/Evening
    displayHours = hours - 12;
    ampm = 'PM';
  }

  // Format: "YYYY-MM-DD H:MM:SS AM/PM"
  // Note: Using single digit hours (9:30:00 not 09:30:00) to match CSV format
  return `${date} ${displayHours}:${minutes
    .toString()
    .padStart(2, '0')}:00 ${ampm}`;
}
