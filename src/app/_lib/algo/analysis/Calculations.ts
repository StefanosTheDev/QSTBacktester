// Calculations.ts
export function calculateLinearRegression(y: number[]): {
  slope: number;
  residuals: number[];
} {
  const N = y.length;
  const x = Array.from({ length: N }, (_, i) => i);
  const meanX = x.reduce((a, b) => a + b, 0) / N;
  const meanY = y.reduce((a, b) => a + b, 0) / N;
  const covXY = x.reduce((s, xi, i) => s + (xi - meanX) * (y[i] - meanY), 0);
  const varX = x.reduce((s, xi) => s + (xi - meanX) ** 2, 0);
  const slope = covXY / varX;
  const residuals = y.map((yi, i) => yi - slope * i);

  return { slope, residuals };
}
// utils/calculations.ts
import { csvFiles, CandleType, BarType, MonthKey } from '../data/csvFiles';
// src/utils/tradingDays.ts
import Holidays from 'date-holidays';
import { eachDayOfInterval, isWeekend, parseISO, format } from 'date-fns';

export function formatEasternTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour12: true,
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
// src/app/_lib/algo/src/utils/selectCSV.ts

/** grab “YYYY-MM” from a full timestamp */
function monthKeyFromTimestamp(ts: string): MonthKey {
  return ts.slice(0, 7) as MonthKey;
}

/** list all month-keys between startMonth…endMonth inclusive */
function getMonthKeysInRange(
  startMonth: MonthKey,
  endMonth: MonthKey
): MonthKey[] {
  const months: MonthKey[] = [];
  let [y, m] = startMonth.split('-').map(Number);
  const [endY, endM] = endMonth.split('-').map(Number);

  while (y < endY || (y === endY && m <= endM)) {
    months.push(`${y}-${String(m).padStart(2, '0')}` as MonthKey);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  return months;
}

/**
 * Returns an array of CSV filenames covering the given
 * start→end range for the chosen bar & candle types.
 */
export function selectCSV(
  barType: BarType,
  candleType: CandleType,
  start: string, // "2025-07-22 09:30:00"
  end: string // "2025-09-05 15:00:00"
): string[] {
  const startKey = monthKeyFromTimestamp(start);
  const endKey = monthKeyFromTimestamp(end);
  const months = getMonthKeysInRange(startKey, endKey);

  return months.map((month) => {
    const file = csvFiles[candleType][barType][month];
    if (!file) {
      throw new Error(`No CSV for ${candleType}/${barType} month ${month}`);
    }
    return file;
  });
}

const hd = new Holidays('US'); // NYSE follows US federal holidays
export function getTradingDates(start: string, end: string): string[] {
  const from = parseISO(start.slice(0, 10)); // "2025-07-01"
  const to = parseISO(end.slice(0, 10));
  return eachDayOfInterval({ start: from, end: to })
    .filter((d) => !isWeekend(d) && !hd.isHoliday(d))
    .map((d) => format(d, 'yyyy-MM-dd'));
}
