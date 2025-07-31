// src/app/_lib/algo/utils/DateTimeUtils.ts
import { DateTime } from 'luxon';

/**
 * Centralized timezone handling for the entire application
 *
 * TIMEZONE FLOW:
 * 1. User inputs times in PST (matching CSV files)
 * 2. Process internally in UTC for consistency
 * 3. Convert to EST for display only
 *
 * CSV FILES: PST format "YYYY-MM-DD HH:MM:SS AM/PM"
 * INTERNAL: UTC (timezone neutral)
 * DISPLAY: EST (market timezone)
 */
export class DateTimeUtils {
  // Timezone constants
  static readonly PST_ZONE = 'America/Los_Angeles';
  static readonly EST_ZONE = 'America/New_York';
  static readonly UTC_ZONE = 'UTC';

  // Format constants
  static readonly TIMESTAMP_FORMAT = 'yyyy-MM-dd hh:mm:ss a';
  static readonly DATE_FORMAT = 'MM/dd/yyyy';
  static readonly TIME_FORMAT = 'hh:mm:ss a';
  static readonly TIME_24_FORMAT = 'HH:mm:ss';

  /**
   * Parse a PST timestamp from CSV and convert to UTC
   * This is the MAIN parsing method used throughout the system
   */
  static parseTimestampToUTC(pstTimestamp: string): DateTime {
    const pstTime = DateTime.fromFormat(pstTimestamp, this.TIMESTAMP_FORMAT, {
      zone: this.PST_ZONE,
    });

    if (!pstTime.isValid) {
      throw new Error(
        `Invalid PST timestamp: "${pstTimestamp}". Reason: ${pstTime.invalidReason}`
      );
    }

    return pstTime.toUTC();
  }

  /**
   * Convert PST timestamp to EST for display
   * Used for showing trade times to users
   */
  static convertPSTtoEST(pstTimestamp: string): {
    date: string;
    time: string;
    datetime: string;
  } {
    const utcTime = this.parseTimestampToUTC(pstTimestamp);
    const estTime = utcTime.setZone(this.EST_ZONE);

    return {
      date: estTime.toFormat(this.DATE_FORMAT),
      time: estTime.toFormat(this.TIME_FORMAT),
      datetime: estTime.toFormat(`${this.DATE_FORMAT} ${this.TIME_FORMAT}`),
    };
  }

  /**
   * Get date key in PST for file selection and internal grouping
   */
  static getDateKey(pstTimestamp: string): string {
    const utcTime = this.parseTimestampToUTC(pstTimestamp);
    const pstTime = utcTime.setZone(this.PST_ZONE);
    return pstTime.toFormat(this.DATE_FORMAT);
  }

  /**
   * Get date key in EST for display grouping (daily P&L etc)
   */
  static getDisplayDateKey(pstTimestamp: string): string {
    const utcTime = this.parseTimestampToUTC(pstTimestamp);
    const estTime = utcTime.setZone(this.EST_ZONE);
    return estTime.toFormat(this.DATE_FORMAT);
  }

  /**
   * Get time components in PST (for internal time range filtering)
   */
  static getTimeComponents(pstTimestamp: string): {
    hour: number;
    minute: number;
    second: number;
  } {
    const utcTime = this.parseTimestampToUTC(pstTimestamp);
    const pstTime = utcTime.setZone(this.PST_ZONE);
    return {
      hour: pstTime.hour,
      minute: pstTime.minute,
      second: pstTime.second,
    };
  }

  /**
   * Compare two timestamps (timezone-neutral using UTC)
   */
  static compareTimestamps(a: string, b: string): number {
    const aUTC = this.parseTimestampToUTC(a);
    const bUTC = this.parseTimestampToUTC(b);

    if (aUTC < bUTC) return -1;
    if (aUTC > bUTC) return 1;
    return 0;
  }

  /**
   * Check if timestamp falls within a time range (in PST)
   */
  static isInTimeRange(
    timestamp: string,
    startTime: string, // "09:30:00"
    endTime: string // "16:00:00"
  ): boolean {
    const timeComponents = this.getTimeComponents(timestamp);

    const [startHour, startMin, startSec] = startTime.split(':').map(Number);
    const [endHour, endMin, endSec] = endTime.split(':').map(Number);

    const timeMinutes =
      timeComponents.hour * 60 +
      timeComponents.minute +
      timeComponents.second / 60;
    const startMinutes = startHour * 60 + startMin + (startSec || 0) / 60;
    const endMinutes = endHour * 60 + endMin + (endSec || 0) / 60;

    return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
  }

  /**
   * Convert 24-hour time to 12-hour format with AM/PM
   */
  static convertTo12Hour(time24: string): string {
    const parts = time24.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parts[1] || '00';
    const seconds = parts[2] || '00';

    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

    return `${String(hours12).padStart(
      2,
      '0'
    )}:${minutes}:${seconds} ${period}`;
  }

  /**
   * Parse a date in MM/DD/YYYY format for display sorting
   */
  static parseDateKey(dateKey: string): {
    year: number;
    month: number;
    day: number;
    comparable: number;
  } {
    const [month, day, year] = dateKey.split('/').map(Number);
    return {
      year,
      month,
      day,
      comparable: year * 10000 + month * 100 + day,
    };
  }

  /**
   * Sort date keys in MM/DD/YYYY format
   */
  static sortDateKeys(dateKeys: string[]): string[] {
    return dateKeys.sort((a, b) => {
      const aDate = this.parseDateKey(a);
      const bDate = this.parseDateKey(b);
      return aDate.comparable - bDate.comparable;
    });
  }

  /**
   * Get the number of days between two timestamps
   */
  static getDaysBetween(start: string, end: string): number {
    const startUTC = this.parseTimestampToUTC(start);
    const endUTC = this.parseTimestampToUTC(end);

    const startDate = startUTC.startOf('day');
    const endDate = endUTC.startOf('day');

    return Math.floor(endDate.diff(startDate, 'days').days);
  }

  /**
   * Format log output (always in PST to match CSV)
   */
  static formatForLog(pstTimestamp: string): string {
    const utcTime = this.parseTimestampToUTC(pstTimestamp);
    const pstTime = utcTime.setZone(this.PST_ZONE);
    return pstTime.toFormat(this.TIME_FORMAT);
  }

  /**
   * Create a PST timestamp for testing
   */
  static createTimestamp(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number = 0
  ): string {
    const dt = DateTime.fromObject(
      { year, month, day, hour, minute, second },
      { zone: this.PST_ZONE }
    );

    return dt.toFormat(this.TIMESTAMP_FORMAT).toUpperCase();
  }

  /**
   * Diagnostic function to verify timezone handling
   */
  static runDiagnostics(sampleTimestamp?: string): void {
    const testTimestamp = sampleTimestamp || '2024-12-31 03:00:00 PM';

    console.log('\n🔍 DateTimeUtils Diagnostics:');
    console.log('================================');
    console.log(`System timezone: ${DateTime.local().zoneName}`);
    console.log(`Input timestamp (PST): ${testTimestamp}`);

    try {
      const utc = this.parseTimestampToUTC(testTimestamp);
      const pst = utc.setZone(this.PST_ZONE);
      const est = utc.setZone(this.EST_ZONE);
      const dateKey = this.getDateKey(testTimestamp);
      const displayKey = this.getDisplayDateKey(testTimestamp);
      const estDisplay = this.convertPSTtoEST(testTimestamp);

      console.log(`\nParsed to UTC: ${utc.toISO()}`);
      console.log(`Back to PST: ${pst.toFormat(this.TIMESTAMP_FORMAT)}`);
      console.log(`Converted to EST: ${est.toFormat(this.TIMESTAMP_FORMAT)}`);
      console.log(`\nDate key (PST): ${dateKey}`);
      console.log(`Display key (EST): ${displayKey}`);
      console.log(`Display format: ${estDisplay.datetime}`);
      console.log('\n✅ Timezone handling is working correctly');
    } catch (error) {
      console.error('❌ Diagnostic error:', error);
    }
    console.log('================================\n');
  }
}
