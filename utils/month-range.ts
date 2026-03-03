type TimeZoneDateParts = {
  year: number;
  month: number;
  day: number;
};

export type CurrentMonthToYesterdayRange = {
  since: string;
  until: string;
  hasElapsedDays: boolean;
  timeZone: string;
};

function formatIsoDateUtc(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

export function buildCurrentMonthToYesterdayRange(
  now: Date = new Date(),
  timeZone = process.env.APP_TIMEZONE ?? "America/Sao_Paulo"
): CurrentMonthToYesterdayRange {
  const parts = readTimeZoneDateParts(now, timeZone);
  const monthStart = new Date(Date.UTC(parts.year, parts.month - 1, 1));

  if (parts.day <= 1) {
    const date = formatIsoDateUtc(monthStart);
    return {
      since: date,
      until: date,
      hasElapsedDays: false,
      timeZone
    };
  }

  const todayInTimeZone = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const yesterday = new Date(todayInTimeZone);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  return {
    since: formatIsoDateUtc(monthStart),
    until: formatIsoDateUtc(yesterday),
    hasElapsedDays: true,
    timeZone
  };
}
