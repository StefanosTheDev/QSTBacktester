// src/app/_lib/utils.ts
import { FormProp } from '../types/types';
import { DateTimeUtils } from './algo/utils/DateTimeUtils';
import { ApiParams } from './algo/types/types';

/**
 * Build API parameters from form data
 * User inputs times in PST (matching CSV files)
 * No conversion needed!
 */
export function buildParams(formData: FormProp): ApiParams {
  // Convert 24-hour time to 12-hour format with AM/PM
  const startTimeFormatted = DateTimeUtils.convertTo12Hour(formData.startTime);
  const endTimeFormatted = DateTimeUtils.convertTo12Hour(formData.endTime);

  // Create PST timestamps (no conversion needed since user inputs PST)
  const pstStart = `${formData.startDate} ${startTimeFormatted}`;
  const pstEnd = `${formData.endDate} ${endTimeFormatted}`;

  console.log('🕐 Building parameters:');
  console.log(`   Start: ${pstStart} (PST)`);
  console.log(`   End: ${pstEnd} (PST)`);

  // Show EST equivalents for user reference
  const startEST = DateTimeUtils.convertPSTtoEST(pstStart);
  const endEST = DateTimeUtils.convertPSTtoEST(pstEnd);
  console.log(`   EST equivalent: ${startEST.datetime} to ${endEST.datetime}`);

  return {
    start: pstStart,
    end: pstEnd,

    // Bar settings
    barType: formData.barType,
    barSize: formData.barSize,
    candleType: formData.candleType,
    cvdLookBackBars: formData.cvdLookBackBars || 5,

    // Indicator settings
    emaMovingAverage: formData.emaMovingAverage || undefined,
    adxThreshold: formData.adxThreshold || undefined,
    adxPeriod: formData.adxPeriod || 14,
    smaFilter: formData.smaFilter || undefined,
    useVWAP: formData.useVWAP || false,

    // Risk management
    contractSize: formData.contractSize,
    stopLoss: formData.stopLoss,
    takeProfit: formData.takeProfit,

    // Daily limits
    maxDailyLoss: formData.maxDailyLoss || undefined,
    maxDailyProfit: formData.maxDailyProfit || undefined,

    // Trailing stop
    useTrailingStop: formData.useTrailingStop || false,
    breakevenTrigger: formData.breakevenTrigger || 3,
    trailDistance: formData.trailDistance || 2,

    // Trade direction
    tradeDirection: formData.tradeDirection || 'both',
  };
}
