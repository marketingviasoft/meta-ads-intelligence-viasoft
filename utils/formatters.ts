const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function formatCurrencyBRL(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return currencyFormatter.format(value);
}

export function formatNumberBR(
  value: number | null,
  minimumFractionDigits = 0,
  maximumFractionDigits = 0
): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits,
    maximumFractionDigits
  }).format(value);
}

export function formatPercentBR(value: number | null, maximumFractionDigits = 2): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return `${formatNumberBR(value, 0, maximumFractionDigits)}%`;
}

export function formatSignedPercentBR(value: number | null, maximumFractionDigits = 2): string {
  if (value === null || !Number.isFinite(value)) {
    return "n/a";
  }

  const signal = value > 0 ? "+" : "";
  return `${signal}${formatPercentBR(value, maximumFractionDigits)}`;
}

export function formatDateShortBR(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit"
  }).format(date);
}

export function formatDateLongBR(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}