import { FormProp } from '../types/types';

/**
 * Extended form parameters including ISO start/end strings.
 */
export interface FormParams extends FormProp {
  start: string;
  end: string;
}

/**
 * Build form parameters by adding ISO date-time strings 'start' and 'end'.
 * Returns the original form values plus `start`/`end` for backtesting.
 */
export function buildParams(input: FormProp): FormParams {
  const { startDate, startTime, endDate, endTime, ...rest } = input;

  // 1) Build PST‐formatted strings
  const start = toCsvPst(startDate, startTime); // e.g. "2025-07-14 09:30:00"
  const end = toCsvPst(endDate, endTime); // e.g. "2025-07-14 13:00:00"

  // 2) Filter out zero‐valued numeric fields as before
  const filtered = Object.fromEntries(
    Object.entries(rest).filter(([_, v]) => v !== 0)
  ) as Omit<FormProp, 'startDate' | 'startTime' | 'endDate' | 'endTime'>;

  return {
    ...filtered,
    start,
    end,
    maxDailyLoss: input.maxDailyLoss,
    maxDailyProfit: input.maxDailyProfit,
  } as FormParams;
}
/**
 * Given a date “YYYY-MM-DD” and time “HH:mm”, return
 * “YYYY-MM-DD HH:mm:00” (PST), no timezone suffix.
 */
export function toCsvPst(date: string, time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const isPM = hours >= 12;
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const ampm = isPM ? 'PM' : 'AM';

  return `${date} ${displayHours}:${minutes
    .toString()
    .padStart(2, '0')}:00 ${ampm}`;
}
