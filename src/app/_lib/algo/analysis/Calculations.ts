// src/app/_lib/algo/analysis/Calculations.ts
import Holidays from 'date-holidays';
import { csvFiles, CandleType, BarType, MonthKey } from '../data/csvFiles';

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

export function formatEasternTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour12: true,
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** grab "YYYY-MM" from a full timestamp */
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

// FIXED VERSION - Timezone safe trading dates
const hd = new Holidays('US'); // NYSE follows US federal holidays
export function getTradingDates(start: string, end: string): string[] {
  // Extract just the date part (YYYY-MM-DD)
  const startDate = start.slice(0, 10);
  const endDate = end.slice(0, 10);

  // Parse dates as UTC to avoid timezone issues
  const from = new Date(startDate + 'T00:00:00.000Z');
  const to = new Date(endDate + 'T00:00:00.000Z');

  const dates: string[] = [];
  const current = new Date(from);

  while (current <= to) {
    // Check if it's a weekday using UTC methods
    const dayOfWeek = current.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Not Sunday (0) or Saturday (6)
      // Format as YYYY-MM-DD
      const year = current.getUTCFullYear();
      const month = String(current.getUTCMonth() + 1).padStart(2, '0');
      const day = String(current.getUTCDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      // Check if it's a holiday
      // Create a local date for holiday checking (holidays are timezone-specific)
      const localDate = new Date(
        year,
        current.getUTCMonth(),
        current.getUTCDate()
      );
      if (!hd.isHoliday(localDate)) {
        dates.push(dateStr);
      }
    }

    // Move to next day
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}
