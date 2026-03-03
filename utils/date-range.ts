import { ALLOWED_RANGE_DAYS, type DateRangeSelection, type RangeDays } from "@/lib/types";

function startOfToday(source: Date): Date {
  const date = new Date(source);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(source: Date, days: number): Date {
  const date = new Date(source);
  date.setDate(date.getDate() + days);
  return date;
}

function formatISODate(source: Date): string {
  const year = source.getFullYear();
  const month = String(source.getMonth() + 1).padStart(2, "0");
  const day = String(source.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isValidRangeDays(value: number): value is RangeDays {
  return ALLOWED_RANGE_DAYS.includes(value as RangeDays);
}

export function parseRangeDays(value: string | null | undefined): RangeDays {
  const parsed = Number.parseInt(value ?? "", 10);
  if (isValidRangeDays(parsed)) {
    return parsed;
  }

  return 7;
}

export function buildDateRange(days: RangeDays, now: Date = new Date()): DateRangeSelection {
  const today = startOfToday(now);

  // Day 0 is always excluded. The range ends at yesterday.
  const endDate = addDays(today, -1);
  const startDate = addDays(endDate, -(days - 1));

  const previousEnd = addDays(startDate, -1);
  const previousStart = addDays(previousEnd, -(days - 1));

  return {
    days,
    since: formatISODate(startDate),
    until: formatISODate(endDate),
    previousSince: formatISODate(previousStart),
    previousUntil: formatISODate(previousEnd)
  };
}