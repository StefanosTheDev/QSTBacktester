// src/strategy/readCSV.ts - FIXED VERSION WITH PST HANDLING
import fs from 'fs';
import path from 'path';
import { Parser } from 'csv-parse';
import { CsvBar } from './types';
import { getTradingDates } from '../utils'; // Import your trading dates function

const BASE_DIR = path.join(process.cwd(), 'src/app/_lib/algo/src/csv_database');

// Parse timestamp ensuring PST interpretation
function parsePSTTimestamp(timestamp: string): Date {
  // Handle edge cases
  if (!timestamp) {
    throw new Error('Timestamp is undefined or empty');
  }

  // "2025-01-15 09:30:00 AM" → force PST interpretation
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

  // Create date assuming PST (UTC-8), but during DST it's PDT (UTC-7)
  // For consistency, we'll use UTC-8 year-round since your CSVs are labeled PST
  const utcDate = Date.UTC(year, month - 1, day, hours + 8, minutes, seconds);
  return new Date(utcDate);
}

// Extract time in 24-hour format directly from timestamp string
// This avoids all timezone conversion issues
function extractTimeFromTimestamp(timestamp: string): string {
  // "2025-01-15 9:30:00 AM" → "09:30:00"
  const parts = timestamp.split(' ');
  if (parts.length !== 3) return '00:00:00';

  const timePart = parts[1]; // "9:30:00"
  const ampm = parts[2]; // "AM" or "PM"

  const timeParts = timePart.split(':');
  if (timeParts.length !== 3) return '00:00:00';

  let hours = parseInt(timeParts[0]);
  const minutes = timeParts[1];
  const seconds = timeParts[2];

  // Convert to 24-hour format
  if (ampm === 'PM' && hours !== 12) {
    hours += 12;
  } else if (ampm === 'AM' && hours === 12) {
    hours = 0;
  }

  // Return in 24-hour format with zero padding
  return `${hours.toString().padStart(2, '0')}:${minutes.padStart(
    2,
    '0'
  )}:${seconds.padStart(2, '0')}`;
}

export async function* streamCsvBars(
  csvFiles: string[],
  start: string, // "2025-07-20 6:00:00 PM"
  end: string, // "2025-07-22 6:10:00 PM"
  params?: {
    // Add optional params for selective filtering
    emaMovingAverage?: number;
    adxPeriod?: number;
    adxThreshold?: number;
    cvdLookBackBars?: number;
  }
): AsyncGenerator<CsvBar> {
  // Parse the start and end dates using PST interpretation
  let startDate: Date;
  let endDate: Date;

  try {
    startDate = parsePSTTimestamp(start);
    endDate = parsePSTTimestamp(end);
  } catch (error) {
    console.error('Error parsing start/end dates:', error);
    console.error('Start input:', start);
    console.error('End input:', end);
    throw new Error(`Failed to parse date parameters: ${error}`);
  }

  // Extract times directly from the input strings (avoiding timezone issues)
  const startTime = extractTimeFromTimestamp(start);
  const endTime = extractTimeFromTimestamp(end);

  // Get only valid trading dates (excludes weekends and holidays)
  const tradingDates = getTradingDates(start, end);
  const tradingDateSet = new Set(tradingDates);

  console.log(
    `🎯 Target time window: ${startTime} to ${endTime} (24-hour format PST)`
  );
  console.log(`📅 Valid trading dates: ${tradingDates.join(', ')}`);
  console.log(`🔍 DEBUG - Received params:`, params);
  console.log(`🔍 DEBUG - Start: "${start}" → Time: ${startTime}`);
  console.log(`🔍 DEBUG - End: "${end}" → Time: ${endTime}`);

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

      // Parse the bar timestamp using PST interpretation
      let barDate: Date;
      try {
        barDate = parsePSTTimestamp(timestamp);
      } catch (error) {
        console.error(`Error parsing bar timestamp: "${timestamp}"`, error);
        continue; // Skip this bar if we can't parse its timestamp
      }

      // Check if this bar falls within our overall date range
      if (barDate < startDate || barDate > endDate) {
        continue;
      }

      // Extract date portion and check if it's a valid trading date
      const barDateString = timestamp.split(' ')[0]; // "2025-07-20"
      if (!tradingDateSet.has(barDateString)) {
        // Skip non-trading days (weekends, holidays)
        continue;
      }

      // Get bar time in 24-hour format for comparison
      const barTime = extractTimeFromTimestamp(timestamp);

      // Debug first few comparisons
      if (debugCount < 3 && barsFromThisFile === 0) {
        console.log(`🔍 DEBUG - Bar timestamp: ${timestamp}`);
        console.log(`🔍 DEBUG - Bar time (24h): ${barTime}`);
        console.log(
          `🔍 DEBUG - Time comparison: ${barTime} >= ${startTime} && ${barTime} <= ${endTime} = ${
            barTime >= startTime && barTime <= endTime
          }`
        );
        debugCount++;
      }

      // Check if this bar falls within our daily time window
      if (barTime >= startTime && barTime <= endTime) {
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
