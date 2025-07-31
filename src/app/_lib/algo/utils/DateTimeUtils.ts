// src/strategy/utils/DateTimeUtils.ts
import { DateTime } from 'luxon';

// IMPORTANT: Remove the TZ override - we'll handle timezones explicitly
// DO NOT rely on process.env.TZ as it's inconsistent between environments

export class DateTimeUtils {
  private static readonly PST_ZONE = 'America/Los_Angeles';
  private static readonly TIMESTAMP_FORMAT = 'yyyy-MM-dd hh:mm:ss a';

  /**
   * Parse timestamp string to DateTime object in PST
   * This ensures consistent parsing regardless of server timezone
   */
  static parseTimestamp(timestamp: string): DateTime {
    // Always parse in PST timezone explicitly
    return DateTime.fromFormat(timestamp, this.TIMESTAMP_FORMAT, {
      zone: this.PST_ZONE,
      setZone: true, // Important: this ensures the DateTime is in PST
    });
  }

  /**
   * Parse timestamp components WITHOUT using Date objects
   * This is timezone-independent
   */
  static parseTimestampToComponents(timestamp: string): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    dateKey: string;
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

    const dateKey = `${String(month).padStart(2, '0')}/${String(day).padStart(
      2,
      '0'
    )}/${year}`;

    return {
      year,
      month,
      day,
      hour: hour24,
      minute: minutes,
      second: seconds,
      dateKey,
    };
  }

  /**
   * Get consistent date key in MM/DD/YYYY format
   * NEVER use Date object for parsing
   */
  static getDateKey(timestamp: string): string {
    try {
      // First try manual parsing (timezone independent)
      const components = this.parseTimestampToComponents(timestamp);
      return components.dateKey;
    } catch (error) {
      // If that fails, use Luxon with explicit timezone
      const dt = this.parseTimestamp(timestamp);
      if (dt.isValid) {
        return dt.toFormat('MM/dd/yyyy');
      }

      // Last resort - but this should never happen
      console.error('Failed to parse timestamp:', timestamp, error);
      return '';
    }
  }

  /**
   * Convert PST timestamp to EST display format
   * Using component parsing to avoid timezone issues
   */
  static convertPSTtoEST(timestamp: string): { date: string; time: string } {
    try {
      const components = this.parseTimestampToComponents(timestamp);

      // Add 3 hours for PST to EST conversion
      let estHour = components.hour + 3;
      let estDay = components.day;
      let estMonth = components.month;
      let estYear = components.year;

      // Handle day rollover
      if (estHour >= 24) {
        estHour -= 24;
        estDay++;

        const daysInMonth = new Date(estYear, estMonth, 0).getDate();
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
      const dateStr = `${String(estMonth).padStart(2, '0')}/${String(
        estDay
      ).padStart(2, '0')}/${estYear}`;

      let displayHour = estHour;
      let displayAmPm = 'AM';
      if (estHour >= 12) {
        displayAmPm = 'PM';
        if (estHour > 12) displayHour = estHour - 12;
      }
      if (displayHour === 0) displayHour = 12;

      const timeStr = `${String(displayHour).padStart(2, '0')}:${String(
        components.minute
      ).padStart(2, '0')}:${String(components.second).padStart(
        2,
        '0'
      )} ${displayAmPm}`;

      return { date: dateStr, time: timeStr };
    } catch (error) {
      console.error('Error converting PST to EST:', timestamp, error);
      return { date: 'Invalid', time: 'Invalid' };
    }
  }

  /**
   * Get hour and minute from timestamp
   */
  static getTimeComponents(timestamp: string): {
    hour: number;
    minute: number;
  } {
    try {
      const components = this.parseTimestampToComponents(timestamp);
      return { hour: components.hour, minute: components.minute };
    } catch (error) {
      // Fallback to Luxon
      const dt = this.parseTimestamp(timestamp);
      return { hour: dt.hour, minute: dt.minute };
    }
  }

  /**
   * Format DateTime for logging
   */
  static formatForLog(timestamp: string): string {
    const dt = this.parseTimestamp(timestamp);
    return dt.toLocaleString(DateTime.TIME_SIMPLE);
  }

  /**
   * Create a timestamp string in the expected format
   * Useful for testing or generating timestamps
   */
  static createTimestamp(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number = 0
  ): string {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

    return (
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(
        2,
        '0'
      )} ` +
      `${displayHour}:${String(minute).padStart(2, '0')}:${String(
        second
      ).padStart(2, '0')} ${ampm}`
    );
  }
}
