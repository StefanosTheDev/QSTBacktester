// src/app/_lib/algo/analysis/Calculations.ts
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

// NYSE holidays for 2025 (hardcoded to avoid timezone issues)
const NYSE_HOLIDAYS_2025 = new Set([
  '2025-01-01', // New Year's Day
  '2025-01-20', // Martin Luther King Jr. Day
  '2025-02-17', // Presidents Day
  '2025-04-18', // Good Friday
  '2025-05-26', // Memorial Day
  '2025-06-19', // Juneteenth
  '2025-07-04', // Independence Day
  '2025-09-01', // Labor Day
  '2025-11-27', // Thanksgiving Day
  '2025-12-25', // Christmas Day
]);

// FIXED VERSION - Completely timezone safe trading dates
export function getTradingDates(start: string, end: string): string[] {
  // Extract just the date part (YYYY-MM-DD)
  const startDate = start.slice(0, 10);
  const endDate = end.slice(0, 10);

  const dates: string[] = [];

  // Parse start date components
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

  // Create a date counter
  let year = startYear;
  let month = startMonth;
  let day = startDay;

  // Days in each month (accounting for leap years)
  const getDaysInMonth = (y: number, m: number): number => {
    if (m === 2) {
      // February - check for leap year
      return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
    }
    return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  };

  // Day of week calculation (Zeller's congruence)
  const getDayOfWeek = (y: number, m: number, d: number): number => {
    if (m < 3) {
      m += 12;
      y -= 1;
    }
    const k = y % 100;
    const j = Math.floor(y / 100);
    const h =
      (d +
        Math.floor((13 * (m + 1)) / 5) +
        k +
        Math.floor(k / 4) +
        Math.floor(j / 4) -
        2 * j) %
      7;
    return (h + 6) % 7; // 0 = Sunday, 1 = Monday, etc.
  };

  // Iterate through dates
  while (
    year < endYear ||
    (year === endYear && month < endMonth) ||
    (year === endYear && month === endMonth && day <= endDay)
  ) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(
      day
    ).padStart(2, '0')}`;
    const dayOfWeek = getDayOfWeek(year, month, day);

    // Check if it's a weekday (not Saturday=6 or Sunday=0) and not a holiday
    if (
      dayOfWeek !== 0 &&
      dayOfWeek !== 6 &&
      !NYSE_HOLIDAYS_2025.has(dateStr)
    ) {
      dates.push(dateStr);
    }

    // Move to next day
    day++;
    if (day > getDaysInMonth(year, month)) {
      day = 1;
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }
  }

  return dates;
}
