// Fixed version of streamCsvBars that handles daily time windows with AM/PM support
import fs from 'fs';
import path from 'path';
import { Parser } from 'csv-parse';
import { CsvBar } from './types';
import { getTradingDates } from '../utils'; // Import your trading dates function

const BASE_DIR = path.join(process.cwd(), 'src/app/_lib/algo/src/csv_database');

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
  // Parse the start and end to extract date range and time window
  const startDate = new Date(start);
  const endDate = new Date(end);

  // Convert AM/PM times to 24-hour format for proper comparison
  const startDateTime = new Date(start);
  const endDateTime = new Date(end);
  const startTime = startDateTime.toTimeString().split(' ')[0]; // "18:00:00"
  const endTime = endDateTime.toTimeString().split(' ')[0]; // "18:10:00"

  // Get only valid trading dates (excludes weekends and holidays)
  const tradingDates = getTradingDates(start, end);
  const tradingDateSet = new Set(tradingDates);

  console.log(
    `🎯 Target time window: ${startTime} to ${endTime} (24-hour format)`
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

  // 2) Stream through each CSV file
  for (const f of csvFiles) {
    const full = path.join(BASE_DIR, f);
    console.log(`▶️ Streaming ${full}`);

    const parser = new Parser({ columns: true, skip_empty_lines: true });
    const input = fs.createReadStream(full).pipe(parser);

    let barsFromThisFile = 0;

    for await (const record of input as AsyncIterable<Record<string, string>>) {
      const timestamp = record.timestamp; // e.g., "2025-07-20 03:00:00 PM"

      if (!timestamp) continue;

      const barDate = new Date(timestamp);

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

      // Convert CSV timestamp AM/PM to 24-hour format for comparison
      const barDateTime = new Date(timestamp);
      const barTime = barDateTime.toTimeString().split(' ')[0]; // "15:00:00"

      // Debug first few comparisons
      if (barsFromThisFile < 3) {
        console.log(`🔍 DEBUG - Bar timestamp: ${timestamp}`);
        console.log(`🔍 DEBUG - Bar time (24h): ${barTime}`);
        console.log(
          `🔍 DEBUG - Start time: ${startTime}, End time: ${endTime}`
        );
        console.log(
          `🔍 DEBUG - Time comparison: ${barTime} >= ${startTime} && ${barTime} <= ${endTime} = ${
            barTime >= startTime && barTime <= endTime
          }`
        );
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

        // Build base log data
        const logData: any = {
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume,
          delta: bar.delta,
          cvd_close: bar.cvd_close,
        };

        // Add EMA value if requested
        if (params?.emaMovingAverage) {
          const requestedEma = `ema_${params.emaMovingAverage}` as keyof CsvBar;
          const emaValue = bar[requestedEma];

          console.log(
            `🎯 EMA ${params.emaMovingAverage} requested - Value: ${emaValue}`
          );
          logData[`ema_${params.emaMovingAverage}`] = emaValue;
        }

        // Add ADX metrics if ADX period is specified
        if (params?.adxPeriod) {
          console.log(`📈 ADX Period ${params.adxPeriod} requested`);
          console.log(
            `📊 ADX Metrics - DX: ${bar.dx}, ADX: ${bar.adx}, ADXR: ${bar.adxr}`
          );
          console.log(
            `📊 Directional Indicators - +DI: ${bar.plus_di}, -DI: ${bar.minus_di}`
          );

          logData.dx = bar.dx;
          logData.adx = bar.adx;
          logData.adxr = bar.adxr;
          logData.plus_di = bar.plus_di;
          logData.minus_di = bar.minus_di;
        }

        // Show ADX threshold check if specified
        if (params?.adxThreshold) {
          const meetsThreshold = (bar.adx ?? 0) >= params.adxThreshold;
          console.log(
            `🎯 ADX Threshold ${params.adxThreshold} - Current ADX: ${bar.adx} - Meets threshold: ${meetsThreshold}`
          );
          logData.adx_threshold_met = meetsThreshold;
        }

        // Log the complete bar data
        console.log(`📊 Complete bar data for ${timestamp}:`, logData);

        yield bar;

        barsFromThisFile++;
        totalBarsYielded++;
      }
    }

    console.log(`✅ File ${f}: Found ${barsFromThisFile} bars in time window`);
  }

  console.log(`🎉 Total bars yielded across all files: ${totalBarsYielded}`);
}
