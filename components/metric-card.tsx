"use client";

import { CircleMinus, CircleX, Minus, ShieldCheck, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { formatCurrencyBRL, formatNumberBR, formatSignedPercentBR } from "@/utils/formatters";
import { getMetricStatus, type MetricStatus } from "@/utils/metric-health";

type MetricKey = "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "results";

type MetricCardProps = {
  metricKey: MetricKey;
  title: string;
  description?: string;
  value: string;
  highlighted?: boolean;
  icon?: ReactNode;
  previousValue?: string;
  deltaAbsolute?: number | null;
  deltaPercent: number | null;
  noPrevData?: boolean;
  inverse?: boolean;
  note?: string;
};

type StatusBadgeStyle = {
  backgroundColor: string;
  color: string;
  borderColor: string;
};

function getDeltaTone(deltaPercent: number | null, inverse: boolean, noPrevData: boolean): string {
  if (noPrevData || deltaPercent === null || deltaPercent === 0) {
    return "text-slate-600";
  }

  const favorable = inverse ? deltaPercent < 0 : deltaPercent > 0;
  return favorable ? "text-emerald-800" : "text-rose-800";
}

function getStatusBadgeTone(status: MetricStatus): string {
  switch (status) {
    case "healthy":
      return "border";
    case "warning":
      return "border";
    case "critical":
      return "border";
    case "na":
    default:
      return "border";
  }
}

function getStatusBadgeStyle(status: MetricStatus): StatusBadgeStyle {
  switch (status) {
    case "healthy":
      return {
        backgroundColor: "#ecfdf5",
        color: "#047857",
        borderColor: "#a7f3d0"
      };
    case "warning":
      return {
        backgroundColor: "#fffbeb",
        color: "#b45309",
        borderColor: "#fcd34d"
      };
    case "critical":
      return {
        backgroundColor: "#fff1f2",
        color: "#be123c",
        borderColor: "#fda4af"
      };
    case "na":
    default:
      return {
        backgroundColor: "#f1f5f9",
        color: "#475569",
        borderColor: "#cbd5e1"
      };
  }
}

function getStatusBadgeIcon(status: MetricStatus): ReactNode {
  switch (status) {
    case "healthy":
      return <ShieldCheck size={12} className="shrink-0" />;
    case "warning":
      return <TriangleAlert size={12} className="shrink-0" />;
    case "critical":
      return <CircleX size={12} className="shrink-0" />;
    case "na":
    default:
      return <CircleMinus size={12} className="shrink-0" />;
  }
}

function getStatusCardTint(status: MetricStatus, showStatusBadge: boolean): string {
  if (!showStatusBadge) {
    return "";
  }

  switch (status) {
    case "healthy":
      return "bg-emerald-50/60";
    case "warning":
      return "bg-amber-50/60";
    case "critical":
      return "bg-rose-50/60";
    case "na":
    default:
      return "";
  }
}

function DeltaIcon({ deltaPercent }: { deltaPercent: number }) {
  if (deltaPercent > 0) {
    return <TrendingUp size={14} className="shrink-0" />;
  }

  if (deltaPercent < 0) {
    return <TrendingDown size={14} className="shrink-0" />;
  }

  return <Minus size={14} className="shrink-0" />;
}

function getSignedPrefix(value: number): string {
  if (value < 0) {
    return "-";
  }

  return "+";
}

function formatAbsoluteDelta(metricKey: MetricKey, deltaAbsolute: number): string {
  const sign = getSignedPrefix(deltaAbsolute);
  const absoluteValue = Math.abs(deltaAbsolute);

  if (metricKey === "spend" || metricKey === "cpc") {
    return `(${sign}${formatCurrencyBRL(absoluteValue)})`;
  }

  if (metricKey === "ctr") {
    return `(${sign}${formatNumberBR(absoluteValue, 2, 2)} p.p.)`;
  }

  return `(${sign}${formatNumberBR(absoluteValue, 0, 0)})`;
}

export function MetricCard({
  metricKey,
  title,
  description,
  value,
  highlighted = false,
  icon,
  previousValue,
  deltaAbsolute,
  deltaPercent,
  noPrevData = false,
  inverse = false,
  note
}: MetricCardProps) {
  const hasDelta =
    deltaPercent !== null && deltaPercent !== undefined && Number.isFinite(deltaPercent);
  const hasAbsoluteDelta =
    deltaAbsolute !== null && deltaAbsolute !== undefined && Number.isFinite(deltaAbsolute);
  const showStatusBadge = metricKey !== "spend";
  const status = showStatusBadge ? getMetricStatus(metricKey, deltaPercent, inverse, noPrevData) : null;
  const statusValue: MetricStatus = status?.status ?? "na";
  const statusTint = getStatusCardTint(statusValue, showStatusBadge);
  const deltaTone = getDeltaTone(hasDelta ? deltaPercent : null, inverse, noPrevData);
  const showDeltaAccent = !noPrevData && hasDelta && deltaPercent !== 0;
  const deltaLabel = noPrevData
    ? "Sem dados suficientes para comparação"
    : hasDelta
      ? `${formatSignedPercentBR(deltaPercent)} em relação ao período anterior`
      : "n/a em relação ao período anterior";
  const absoluteDeltaLabel =
    !noPrevData && hasAbsoluteDelta ? formatAbsoluteDelta(metricKey, deltaAbsolute) : null;
  const helperLabel = note ?? (!noPrevData && previousValue
    ? `Período anterior: ${previousValue}${absoluteDeltaLabel ? ` ${absoluteDeltaLabel}` : ""}`
    : null);
  const statusBadge = showStatusBadge && status ? (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none ${getStatusBadgeTone(status.status)}`}
      style={getStatusBadgeStyle(status.status)}
    >
      {getStatusBadgeIcon(status.status)}
      <span>{status.label}</span>
    </span>
  ) : null;

  return (
    <article
      className={`metric-card enter-fade relative overflow-hidden rounded-xl bg-white shadow-sm p-4 ${
        highlighted ? "ring-2 ring-viasoft/35 bg-viasoft/5" : statusTint
      } ${highlighted ? "metric-card-highlighted" : ""}`}
    >
      <div className="flex min-h-[20px] items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-wide leading-4 text-slate-600">
          {icon ? (
            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-viasoft">
              {icon}
            </span>
          ) : null}
          <p>{title}</p>
        </div>
        {statusBadge}
      </div>
      {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      <p
        className={`mt-2 flex items-center gap-1.5 text-sm font-semibold ${
          showDeltaAccent
            ? `inline-flex rounded-md border border-slate-200/70 bg-slate-50 px-2 py-1 ${deltaTone}`
            : deltaTone
        }`}
      >
        {!noPrevData && hasDelta ? <DeltaIcon deltaPercent={deltaPercent} /> : null}
        <span>{deltaLabel}</span>
      </p>
      {helperLabel ? <p className="mt-1 text-xs text-slate-500">{helperLabel}</p> : null}
    </article>
  );
}
