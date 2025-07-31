// src/app/_lib/algo/data/readCSV.ts - FIXED VERSION
import fs from 'fs';
import path from 'path';
import { Parser } from 'csv-parse';
import { CsvBar } from '../types/types';
import { getTradingDates } from '../analysis/Calculations';

const BASE_DIR = path.join(
  process.cwd(),
  'src/app/_lib/algo/data/csv_database'
);

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
    throw new Error(`Invalid timestamp format: "${timestamp}"`);
  }

  const [datePart, timePart, ampm] = parts;
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes, seconds] = timePart.split(':').map(Number);

  // Convert to 24-hour WITHOUT timezone interpretation
  let hour24 = hours;
  if (ampm === 'PM' && hours !== 12) hour24 += 12;
  if (ampm === 'AM' && hours === 12) hour24 = 0;

  // Create standardized keys for comparison
  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(
    day
  ).padStart(2, '0')}`;
  const timeKey = `${String(hour24).padStart(2, '0')}:${String(
    minutes
  ).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return {
    year,
    month,
    day,
    hour24,
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
  start: string,
  end: string,
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

  console.log(`\n📊 CSV Reader Configuration:`);
  console.log(
    `   - Date Range: ${startComponents.dateKey} to ${endComponents.dateKey}`
  );
  console.log(
    `   - Time Range: ${startComponents.timeKey} to ${endComponents.timeKey} (PST)`
  );
  console.log(`   - Trading Days: ${tradingDates.length}`);
  console.log(`   - CSV Files: ${csvFiles.length}`);

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
  let firstBarWithSMA = false;
  let firstBarWithVWAP = false;

  // 2) Stream through each CSV file
  for (const f of csvFiles) {
    const full = path.join(BASE_DIR, f);
    console.log(`\n▶️ Streaming ${f}`);

    const parser = new Parser({ columns: true, skip_empty_lines: true });
    const input = fs.createReadStream(full).pipe(parser);

    let barsFromThisFile = 0;

    for await (const record of input as AsyncIterable<Record<string, string>>) {
      const timestamp = record.timestamp;

      if (!timestamp) continue;

      // Skip header row
      if (timestamp === 'timestamp') continue;

      // Parse the bar timestamp into components
      let barComponents: ReturnType<typeof parseTimestampToComponents>;
      try {
        barComponents = parseTimestampToComponents(timestamp);
      } catch (error) {
        console.error(`Error parsing bar timestamp: "${timestamp}"`, error);
        continue;
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

      // Check if this bar falls within our daily time window
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
          cvd_open: record.cvd_open ? parseFloat(record.cvd_open) : undefined,
          cvd_high: record.cvd_high ? parseFloat(record.cvd_high) : undefined,
          cvd_low: record.cvd_low ? parseFloat(record.cvd_low) : undefined,
          cvd_close: record.cvd_close
            ? parseFloat(record.cvd_close)
            : undefined,
          cvd_color: record.cvd_color || undefined,

          // ADX/DI fields (always include if available)
          plus_di: record['+di'] ? parseFloat(record['+di']) : undefined,
          minus_di: record['-di'] ? parseFloat(record['-di']) : undefined,
          dx: record.dx ? parseFloat(record.dx) : undefined,
          adx: record.adx ? parseFloat(record.adx) : undefined,
          adxr: record.adxr ? parseFloat(record.adxr) : undefined,

          // All EMA fields (always include if available)
          ema_8: record.ema_8 ? parseFloat(record.ema_8) : undefined,
          ema_9: record.ema_9 ? parseFloat(record.ema_9) : undefined,
          ema_13: record.ema_13 ? parseFloat(record.ema_13) : undefined,
          ema_21: record.ema_21 ? parseFloat(record.ema_21) : undefined,
          ema_22: record.ema_22 ? parseFloat(record.ema_22) : undefined,
          ema_50: record.ema_50 ? parseFloat(record.ema_50) : undefined,
          ema_100: record.ema_100 ? parseFloat(record.ema_100) : undefined,
          ema_200: record.ema_200 ? parseFloat(record.ema_200) : undefined,

          // SMA fields
          sma_50: record.sma_50 ? parseFloat(record.sma_50) : undefined,
          sma_100: record.sma_100 ? parseFloat(record.sma_100) : undefined,
          sma_200: record.sma_200 ? parseFloat(record.sma_200) : undefined,

          // VWAP
          vwap: record.vwap ? parseFloat(record.vwap) : undefined,
        };

        // Debug logging for SMA/VWAP (only once)
        if (!firstBarWithSMA && (bar.sma_50 || bar.sma_100 || bar.sma_200)) {
          console.log(`📊 First bar with SMA data found at ${timestamp}:`);
          console.log(`   - SMA50: ${bar.sma_50?.toFixed(2) || 'N/A'}`);
          console.log(`   - SMA100: ${bar.sma_100?.toFixed(2) || 'N/A'}`);
          console.log(`   - SMA200: ${bar.sma_200?.toFixed(2) || 'N/A'}`);
          firstBarWithSMA = true;
        }

        if (!firstBarWithVWAP && bar.vwap) {
          console.log(`📊 First bar with VWAP data found at ${timestamp}:`);
          console.log(`   - VWAP: ${bar.vwap.toFixed(2)}`);
          firstBarWithVWAP = true;
        }

        // Only log first few bars to avoid spam
        if (barsFromThisFile < 3) {
          console.log(`📊 Bar #${barsFromThisFile + 1} for ${timestamp}`);
          // Log SMA/VWAP values for first few bars if available
          if (bar.sma_50 || bar.sma_100 || bar.sma_200 || bar.vwap) {
            console.log(
              `   Indicators: SMA50=${
                bar.sma_50?.toFixed(2) || 'N/A'
              }, SMA100=${bar.sma_100?.toFixed(2) || 'N/A'}, SMA200=${
                bar.sma_200?.toFixed(2) || 'N/A'
              }, VWAP=${bar.vwap?.toFixed(2) || 'N/A'}`
            );
          }
        }

        yield bar;

        barsFromThisFile++;
        totalBarsYielded++;
      }
    }

    console.log(`✅ File ${f}: Found ${barsFromThisFile} bars in time window`);
  }

  console.log(`\n🎉 Total bars yielded across all files: ${totalBarsYielded}`);

  // Summary of indicator availability
  if (!firstBarWithSMA) {
    console.log(`⚠️ WARNING: No SMA data found in any CSV files!`);
  }
  if (!firstBarWithVWAP) {
    console.log(`⚠️ WARNING: No VWAP data found in any CSV files!`);
  }
}
