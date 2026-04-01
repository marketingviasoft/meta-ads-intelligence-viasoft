"use client";

import { Info, Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { formatCurrencyBRL, formatNumberBR, formatSignedPercentBR } from "@/utils/formatters";

type MetricKey = "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "results";

type MetricCardProps = {
  metricKey: MetricKey;
  title: string;
  tooltip?: string;
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

function getDeltaTone(deltaPercent: number | null, inverse: boolean, noPrevData: boolean): string {
  if (noPrevData || deltaPercent === null || deltaPercent === 0) {
    return "text-slate-600";
  }

  const favorable = inverse ? deltaPercent < 0 : deltaPercent > 0;
  return favorable ? "text-emerald-800" : "text-rose-800";
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
  tooltip,
  value,
  highlighted = false,
  icon,
  previousValue,
  deltaAbsolute,
  deltaPercent,
  noPrevData = false,
  inverse = false
}: MetricCardProps) {
  const hasDelta =
    deltaPercent !== null && deltaPercent !== undefined && Number.isFinite(deltaPercent);
  const hasAbsoluteDelta =
    deltaAbsolute !== null && deltaAbsolute !== undefined && Number.isFinite(deltaAbsolute);
  
  const deltaTone = getDeltaTone(hasDelta ? deltaPercent : null, inverse, noPrevData);
  const showDeltaAccent = !noPrevData && hasDelta && deltaPercent !== 0;
  const deltaLabel = noPrevData
    ? "Sem dados suficientes para comparação"
    : hasDelta
      ? `${formatSignedPercentBR(deltaPercent)} em relação ao período anterior`
      : "n/a em relação ao período anterior";
  const absoluteDeltaLabel =
    !noPrevData && hasAbsoluteDelta ? formatAbsoluteDelta(metricKey, deltaAbsolute) : null;
  const helperLabel = (!noPrevData && previousValue
    ? `Período anterior: ${previousValue}${absoluteDeltaLabel ? ` ${absoluteDeltaLabel}` : ""}`
    : null);
  return (
    <article
      className={`metric-card enter-fade relative overflow-visible rounded-2xl bg-white shadow-sm p-4 ${
        highlighted ? "ring-2 ring-viasoft/35 bg-viasoft/5" : ""
      } ${highlighted ? "metric-card-highlighted" : ""}`}
    >
      {tooltip ? (
        <div className="tooltip-trigger group absolute right-3.5 top-3.5 z-50 flex cursor-help items-center justify-center">
          <Info size={15} className="text-slate-300 transition-colors group-hover:text-viasoft" />
          <div className="pointer-events-none absolute bottom-full right-0 mb-2 w-48 -translate-y-1 opacity-0 shadow-lg transition-all group-hover:translate-y-0 group-hover:opacity-100">
            <div className="rounded-xl border border-slate-100 bg-white p-2.5 text-[11px] font-medium leading-relaxed text-slate-600 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] ring-1 ring-slate-900/5">
              {tooltip}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-[20px] items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-wide leading-4 text-slate-600">
          {icon ? (
            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-viasoft">
              {icon}
            </span>
          ) : null}
          <p>{title}</p>
        </div>
      </div>
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
