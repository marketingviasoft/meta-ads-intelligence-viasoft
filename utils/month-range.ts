type TimeZoneDateParts = {
  year: number;
  month: number;
  day: number;
};

export type CurrentMonthToCurrentDateRange = {
  since: string;
  until: string;
  dataUntil: string;
  hasElapsedDays: boolean;
  includesCurrentDay: boolean;
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

export function buildCurrentMonthToCurrentDateRange(
  now: Date = new Date(),
  timeZone = process.env.APP_TIMEZONE ?? "America/Sao_Paulo"
): CurrentMonthToCurrentDateRange {
  const parts = readTimeZoneDateParts(now, timeZone);
  const cycleStart =
    parts.day >= 24
      ? new Date(Date.UTC(parts.year, parts.month - 1, 24))
      : new Date(Date.UTC(parts.year, parts.month - 2, 24));
  const cycleEnd =
    parts.day >= 24
      ? new Date(Date.UTC(parts.year, parts.month, 23))
      : new Date(Date.UTC(parts.year, parts.month - 1, 23));
  const todayInTimeZone = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));

  const hasElapsedDays = todayInTimeZone >= cycleStart;
  if (!hasElapsedDays) {
    const startDate = formatIsoDateUtc(cycleStart);
    return {
      since: startDate,
      until: formatIsoDateUtc(cycleEnd),
      dataUntil: startDate,
      hasElapsedDays: false,
      includesCurrentDay: false,
      timeZone
    };
  }

  const dataUntil = todayInTimeZone <= cycleEnd ? todayInTimeZone : cycleEnd;
  const includesCurrentDay = dataUntil.getTime() === todayInTimeZone.getTime();

  return {
    since: formatIsoDateUtc(cycleStart),
    until: formatIsoDateUtc(cycleEnd),
    dataUntil: formatIsoDateUtc(dataUntil),
    hasElapsedDays: true,
    includesCurrentDay,
    timeZone
  };
}
