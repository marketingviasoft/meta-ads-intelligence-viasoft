import { ALLOWED_RANGE_DAYS, type DateRangeSelection, type RangeDays } from "@/lib/types";

type TimeZoneDateParts = {
  year: number;
  month: number;
  day: number;
};

function readTimeZoneDateParts(now: Date, timeZone: string): TimeZoneDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const parts = formatter.formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? "1970");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "1");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "1");

  return { year, month, day };
}

function addDays(source: Date, days: number): Date {
  const date = new Date(source);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function formatISODate(source: Date): string {
  const year = source.getUTCFullYear();
  const month = String(source.getUTCMonth() + 1).padStart(2, "0");
  const day = String(source.getUTCDate()).padStart(2, "0");
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

export function buildDateRange(
  days: RangeDays,
  now: Date = new Date(),
  timeZone = process.env.APP_TIMEZONE ?? "America/Sao_Paulo"
): DateRangeSelection {
  const { year, month, day } = readTimeZoneDateParts(now, timeZone);
  const today = new Date(Date.UTC(year, month - 1, day));

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
