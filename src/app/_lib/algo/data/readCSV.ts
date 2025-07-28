// src/strategy/readCSV.ts - TRULY TIMEZONE-AGNOSTIC VERSION
import fs from 'fs';
import path from 'path';
import { Parser } from 'csv-parse';
import { CsvBar } from '../types/types';

import { getTradingDates } from '../analysis/Calculations';
const BASE_DIR = path.join(
  process.cwd(),
  'src/app/_lib/algo/data/csv_database'
);
// Helper to parse timestamp components without creating Date objects
function parseTimestampToComponents(timestamp: string): {
  year: number;
  month: number;
  day: number;
  hour24: number;
  minute: number;
  second: number;
  dateKey: string;
  timeKey: string;
} {
  // "2025-01-15 09:30:00 AM" → parse components
  const parts = timestamp.split(' ');
  if (parts.length !== 3) {
    throw new Error(
      `Invalid timestamp format: "${timestamp}". Expected "YYYY-MM-DD HH:MM:SS AM/PM"`
    );
  }

  const [datePart, timePart, ampm] = parts;

  if (!datePart || !timePart || !ampm) {
    throw new Error(`Invalid timestamp components in: "${timestamp}"`);
  }

  const dateParts = datePart.split('-');
  if (dateParts.length !== 3) {
    throw new Error(`Invalid date format in timestamp: "${timestamp}"`);
  }

  const [year, month, day] = dateParts.map(Number);

  const timeParts = timePart.split(':');
  if (timeParts.length !== 3) {
    throw new Error(`Invalid time format in timestamp: "${timestamp}"`);
  }

  let [hours] = timeParts.map(Number);
  const [, minutes, seconds] = timeParts.map(Number);

  // Validate numeric values
  if (
    isNaN(year) ||
    isNaN(month) ||
    isNaN(day) ||
    isNaN(hours) ||
    isNaN(minutes) ||
    isNaN(seconds)
  ) {
    throw new Error(`Invalid numeric values in timestamp: "${timestamp}"`);
  }

  // Convert to 24-hour
  if (ampm === 'PM' && hours !== 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;

  // Create standardized keys for comparison
  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(
    day
  ).padStart(2, '0')}`;
  const timeKey = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
    2,
    '0'
  )}:${String(seconds).padStart(2, '0')}`;

  return {
    year,
    month,
    day,
    hour24: hours,
    minute: minutes,
    second: seconds,
    dateKey,
    timeKey,
  };
}

// Convert components to a date number for easy comparison
function componentsToDateNumber(
  year: number,
  month: number,
  day: number
): number {
  return year * 10000 + month * 100 + day;
}

export async function* streamCsvBars(
  csvFiles: string[],
  start: string, // "2025-07-20 6:00:00 PM"
  end: string, // "2025-07-22 6:10:00 PM"
  params?: {
    emaMovingAverage?: number;
    adxPeriod?: number;
    adxThreshold?: number;
    cvdLookBackBars?: number;
  }
): AsyncGenerator<CsvBar> {
  // Parse start and end into components (no Date objects!)
  const startComponents = parseTimestampToComponents(start);
  const endComponents = parseTimestampToComponents(end);

  // Convert to numbers for easy date comparison
  const startDateNum = componentsToDateNumber(
    startComponents.year,
    startComponents.month,
    startComponents.day
  );
  const endDateNum = componentsToDateNumber(
    endComponents.year,
    endComponents.month,
    endComponents.day
  );

  // Get only valid trading dates (excludes weekends and holidays)
  const tradingDates = getTradingDates(start, end);
  const tradingDateSet = new Set(tradingDates);

  // Enhanced debugging
  console.log(`\n🔍 READCSV DEBUG - Environment:`);
  console.log(
    `   - Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`
  );
  console.log(`   - Current time: ${new Date().toString()}`);
  console.log(`   - Working with components (no timezone issues!):`);
  console.log(
    `   - Start: ${startComponents.dateKey} ${startComponents.timeKey}`
  );
  console.log(`   - End: ${endComponents.dateKey} ${endComponents.timeKey}`);

  console.log(
    `🎯 Target time window: ${startComponents.timeKey} to ${endComponents.timeKey} (24-hour format PST)`
  );
  console.log(`📅 Valid trading dates: ${tradingDates.join(', ')}`);
  console.log(`🔍 DEBUG - Received params:`, params);

  // 1) Validate files exist up-front
  for (const f of csvFiles) {
    const full = path.join(BASE_DIR, f);
    await fs.promises.access(full, fs.constants.R_OK).catch(() => {
      throw new Error(`CSV file not found or unreadable: ${full}`);
    });
  }
  console.log(`✅ All ${csvFiles.length} CSV files validated.`);

  let totalBarsYielded = 0;
  let debugCount = 0;

  // 2) Stream through each CSV file
  for (const f of csvFiles) {
    const full = path.join(BASE_DIR, f);
    console.log(`▶️ Streaming ${full}`);

    const parser = new Parser({ columns: true, skip_empty_lines: true });
    const input = fs.createReadStream(full).pipe(parser);

    let barsFromThisFile = 0;

    for await (const record of input as AsyncIterable<Record<string, string>>) {
      const timestamp = record.timestamp; // e.g., "2025-07-20 3:00:00 PM"

      if (!timestamp) continue;

      // Parse the bar timestamp into components
      let barComponents: ReturnType<typeof parseTimestampToComponents>;
      try {
        barComponents = parseTimestampToComponents(timestamp);
      } catch (error) {
        console.error(`Error parsing bar timestamp: "${timestamp}"`, error);
        continue; // Skip this bar if we can't parse its timestamp
      }

      // Check date range using numbers (no timezone issues!)
      const barDateNum = componentsToDateNumber(
        barComponents.year,
        barComponents.month,
        barComponents.day
      );

      if (barDateNum < startDateNum || barDateNum > endDateNum) {
        continue;
      }

      // Check if it's a valid trading date
      if (!tradingDateSet.has(barComponents.dateKey)) {
        // Skip non-trading days (weekends, holidays)
        continue;
      }

      // Debug first few comparisons
      if (debugCount < 3 && barsFromThisFile === 0) {
        console.log(`🔍 DEBUG - Bar timestamp: ${timestamp}`);
        console.log(`🔍 DEBUG - Bar time (24h): ${barComponents.timeKey}`);
        console.log(
          `🔍 DEBUG - Time comparison: ${barComponents.timeKey} >= ${
            startComponents.timeKey
          } && ${barComponents.timeKey} <= ${endComponents.timeKey} = ${
            barComponents.timeKey >= startComponents.timeKey &&
            barComponents.timeKey <= endComponents.timeKey
          }`
        );
        debugCount++;
      }

      // Check if this bar falls within our daily time window (string comparison works!)
      if (
        barComponents.timeKey >= startComponents.timeKey &&
        barComponents.timeKey <= endComponents.timeKey
      ) {
        // Build complete bar with ALL available fields
        const bar: CsvBar = {
          // Required fields
          timestamp: timestamp,
          open: parseFloat(record.open),
          high: parseFloat(record.high),
          low: parseFloat(record.low),
          close: parseFloat(record.close),
          volume: parseInt(record.volume, 10),
          delta: parseFloat(record.delta),

          // CVD fields (always include if available)
          cvd_open: parseFloat(record.cvd_open),
          cvd_high: parseFloat(record.cvd_high),
          cvd_low: parseFloat(record.cvd_low),
          cvd_close: parseFloat(record.cvd_close),
          cvd_color: record.cvd_color,

          // ADX/DI fields (always include if available)
          plus_di: parseFloat(record['+di']),
          minus_di: parseFloat(record['-di']),
          dx: parseFloat(record.dx),
          adx: parseFloat(record.adx),
          adxr: parseFloat(record.adxr),

          // All EMA fields (always include if available)
          ema_8: parseFloat(record.ema_8),
          ema_9: parseFloat(record.ema_9),
          ema_13: parseFloat(record.ema_13),
          ema_21: parseFloat(record.ema_21),
          ema_22: parseFloat(record.ema_22),
          ema_50: parseFloat(record.ema_50),
          ema_100: parseFloat(record.ema_100),
          ema_200: parseFloat(record.ema_200),
        };

        // Only log first few bars to avoid spam
        if (barsFromThisFile < 3) {
          console.log(`📊 Bar #${barsFromThisFile + 1} for ${timestamp}`);
        }

        yield bar;

        barsFromThisFile++;
        totalBarsYielded++;
      }
    }

    console.log(`✅ File ${f}: Found ${barsFromThisFile} bars in time window`);
  }

  console.log(`🎉 Total bars yielded across all files: ${totalBarsYielded}`);
}
