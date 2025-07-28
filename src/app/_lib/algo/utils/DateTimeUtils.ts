// src/strategy/utils/DateTimeUtils.ts
import { DateTime } from 'luxon';

// Fallback timezone override
if (process.env.TZ !== 'America/Los_Angeles') {
  process.env.TZ = 'America/Los_Angeles';
  console.warn('TZ overridden to America/Los_Angeles');
}

export class DateTimeUtils {
  private static readonly PST_ZONE = 'America/Los_Angeles';
  private static readonly TIMESTAMP_FORMAT = 'yyyy-MM-dd hh:mm:ss a';

  /**
   * Parse timestamp string to DateTime object in PST
   */
  static parseTimestamp(timestamp: string): DateTime {
    return DateTime.fromFormat(timestamp, this.TIMESTAMP_FORMAT, {
      zone: this.PST_ZONE,
    });
  }

  /**
   * Get consistent date key in MM/DD/YYYY format
   */
  static getDateKey(timestamp: string): string {
    const dt = this.parseTimestamp(timestamp);
    if (dt.isValid) {
      return dt.toFormat('MM/dd/yyyy');
    }

    // Fallback parsing
    const datePart = timestamp.split(' ')[0];
    if (datePart && datePart.includes('-')) {
      const [year, month, day] = datePart.split('-');
      return `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
    }

    const fallbackDt = DateTime.fromISO(timestamp, { zone: this.PST_ZONE });
    return fallbackDt.isValid ? fallbackDt.toFormat('MM/dd/yyyy') : '';
  }

  /**
   * Convert PST timestamp to EST display format
   */
  static convertPSTtoEST(timestamp: string): { date: string; time: string } {
    const parts = timestamp.split(' ');
    if (parts.length !== 3) {
      return { date: 'Invalid', time: 'Invalid' };
    }

    const [datePart, timePart, ampm] = parts;
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute, second] = timePart.split(':').map(Number);

    // Convert to 24-hour format
    let hour24 = hour;
    if (ampm === 'PM' && hour !== 12) hour24 += 12;
    if (ampm === 'AM' && hour === 12) hour24 = 0;

    // Add 3 hours for PST to EST conversion
    let estHour = hour24 + 3;
    let estDay = day;
    let estMonth = month;
    let estYear = year;

    // Handle day rollover
    if (estHour >= 24) {
      estHour -= 24;
      estDay++;

      const daysInMonth = new Date(year, month, 0).getDate();
      if (estDay > daysInMonth) {
        estDay = 1;
        estMonth++;
        if (estMonth > 12) {
          estMonth = 1;
          estYear++;
        }
      }
    }

    // Format date and time
    const dateStr = `${estMonth.toString().padStart(2, '0')}/${estDay
      .toString()
      .padStart(2, '0')}/${estYear}`;

    let displayHour = estHour;
    let displayAmPm = 'AM';
    if (estHour >= 12) {
      displayAmPm = 'PM';
      if (estHour > 12) displayHour = estHour - 12;
    }
    if (displayHour === 0) displayHour = 12;

    const timeStr = `${displayHour.toString().padStart(2, '0')}:${minute
      .toString()
      .padStart(2, '0')}:${second.toString().padStart(2, '0')} ${displayAmPm}`;

    return { date: dateStr, time: timeStr };
  }

  /**
   * Get hour and minute from timestamp
   */
  static getTimeComponents(timestamp: string): {
    hour: number;
    minute: number;
  } {
    const dt = this.parseTimestamp(timestamp);
    return { hour: dt.hour, minute: dt.minute };
  }

  /**
   * Format DateTime for logging
   */
  static formatForLog(timestamp: string): string {
    const dt = this.parseTimestamp(timestamp);
    return dt.toLocaleString(DateTime.TIME_SIMPLE);
  }
}
