"use client";

import { Coins, Percent, Target, Wallet } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { DailyMetricPoint } from "@/lib/types";
import {
  formatCurrencyBRL,
  formatDateLongBR,
  formatDateShortBR,
  formatNumberBR,
  formatPercentBR
} from "@/utils/formatters";

type PerformanceChartProps = {
  data: DailyMetricPoint[];
  primaryMetricLabel: string;
  isPdf?: boolean;
};

type TooltipProps = {
  active?: boolean;
  payload?: Array<{
    payload: DailyMetricPoint;
  }>;
  primaryMetricLabel: string;
};

function ChartTooltip({ active, payload, primaryMetricLabel }: TooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const point = payload[0].payload;

  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-xl shadow-slate-900/10 backdrop-blur-sm">
      <p className="mb-2 font-semibold text-ink">{formatDateLongBR(point.date)}</p>
      <ul className="space-y-1.5">
        <li className="flex items-center gap-1.5 text-slate-600">
          <Target size={12} className="text-viasoft" />
          <span>
            {primaryMetricLabel}: <span className="font-semibold text-ink">{formatNumberBR(point.results, 0, 2)}</span>
          </span>
        </li>
        <li className="flex items-center gap-1.5 text-slate-600">
          <Wallet size={12} className="text-teal-700" />
          <span>
            Investimento: <span className="font-semibold text-ink">{formatCurrencyBRL(point.spend)}</span>
          </span>
        </li>
        <li className="flex items-center gap-1.5 text-slate-600">
          <Percent size={12} className="text-indigo-700" />
          <span>
            CTR: <span className="font-semibold text-ink">{formatPercentBR(point.ctr)}</span>
          </span>
        </li>
        <li className="flex items-center gap-1.5 text-slate-600">
          <Coins size={12} className="text-amber-700" />
          <span>
            CPC: <span className="font-semibold text-ink">{formatCurrencyBRL(point.cpc)}</span>
          </span>
        </li>
      </ul>
    </div>
  );
}

export function PerformanceChart({
  data,
  primaryMetricLabel,
  isPdf = false
}: PerformanceChartProps) {
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  const spendGradientId = useId().replace(/:/g, "");
  const resultsGradientId = useId().replace(/:/g, "");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 430px)");
    const sync = () => setIsNarrowViewport(media.matches);

    sync();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }

    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);

  const xAxisInterval = data.length >= 28 ? 3 : data.length >= 14 ? 1 : 0;
  const effectiveXAxisInterval = isNarrowViewport ? 0 : xAxisInterval;
  const leftAxisWidth = isNarrowViewport ? 34 : 64;
  const rightAxisWidth = isNarrowViewport ? 48 : 72;
  const chartBottomMargin = isPdf ? 22 : isNarrowViewport ? 18 : 8;
  const chartLeftMargin = isNarrowViewport ? 0 : 6;
  const chartRightMargin = isNarrowViewport ? 0 : 8;
  const showDots = !isPdf && (!isNarrowViewport || data.length <= 14);
  const showSummaryCards = !isPdf;
  const showLegend = true;
  const totalResults = useMemo(() => data.reduce((sum, point) => sum + point.results, 0), [data]);
  const totalSpend = useMemo(() => data.reduce((sum, point) => sum + point.spend, 0), [data]);
  const peakResults = useMemo(() => Math.max(...data.map((point) => point.results), 0), [data]);
  const peakSpend = useMemo(() => Math.max(...data.map((point) => point.spend), 0), [data]);

  const xAxisTicks = useMemo(() => {
    if (!isNarrowViewport) {
      return undefined;
    }

    if (data.length <= 7) {
      return data.map((point) => point.date);
    }

    const desiredCount = data.length >= 24 ? 4 : data.length >= 14 ? 5 : 6;
    const lastIndex = data.length - 1;
    const step = lastIndex / Math.max(desiredCount - 1, 1);
    const ticks = Array.from({ length: desiredCount }, (_, tickIndex) => {
      const dataIndex = Math.min(lastIndex, Math.round(tickIndex * step));
      return data[dataIndex]?.date;
    }).filter((value): value is string => Boolean(value));

    return Array.from(new Set(ticks));
  }, [data, isNarrowViewport]);

  function formatCurrencyAxis(value: number): string {
    if (!isNarrowViewport) {
      return formatCurrencyBRL(value);
    }

    return `R$${formatNumberBR(value, 0, 0)}`;
  }

  return (
    <div
      className={`w-full rounded-xl border border-viasoft/20 bg-gradient-to-b from-[#f9fcff] via-white to-[#f6fbff] ${isPdf ? "min-h-[248px] p-2.5" : "min-h-[330px] p-3 sm:p-4"}`}
    >
      {showSummaryCards ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="rounded-lg border border-viasoft/20 bg-viasoft/5 px-2.5 py-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-viasoft/80">
              {primaryMetricLabel} acumulado
            </p>
            <p className="text-sm font-semibold text-viasoft">{formatNumberBR(totalResults, 0, 2)}</p>
          </div>
          <div className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-teal-800">
              Investimento acumulado
            </p>
            <p className="text-sm font-semibold text-teal-800">{formatCurrencyBRL(totalSpend)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              Pico diário
            </p>
            <p className="text-sm font-semibold text-slate-700">
              {formatNumberBR(peakResults, 0, 2)} / {formatCurrencyBRL(peakSpend)}
            </p>
          </div>
        </div>
      ) : null}

      <div className={`rounded-lg border border-slate-200/90 bg-white/85 ${isPdf ? "p-2" : "p-2.5 sm:p-3"}`}>
        <div className={isPdf ? "h-[192px]" : isNarrowViewport ? "h-[280px]" : "h-[272px]"}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{
              top: isPdf ? 8 : 10,
              right: chartRightMargin,
              left: chartLeftMargin,
              bottom: chartBottomMargin
            }}
          >
            <defs>
              <linearGradient id={spendGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0f766e" stopOpacity={0.26} />
                <stop offset="100%" stopColor="#0f766e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id={resultsGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#003A4D" stopOpacity={0.14} />
                <stop offset="100%" stopColor="#003A4D" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 4" stroke="#d5e1e9" vertical={false} />
            <XAxis
              dataKey="date"
              ticks={xAxisTicks}
              tickFormatter={formatDateShortBR}
              stroke="#495967"
              fontSize={isNarrowViewport ? 10 : 12}
              minTickGap={isNarrowViewport ? 28 : 18}
              interval={effectiveXAxisInterval}
              tickLine={false}
              axisLine={{ stroke: "#8da2b3", strokeWidth: 1 }}
            />
            <YAxis
              yAxisId="left"
              stroke="#495967"
              tickFormatter={(value) => formatNumberBR(Number(value), 0, 0)}
              width={leftAxisWidth}
              fontSize={isNarrowViewport ? 10 : 12}
              tickCount={isNarrowViewport ? 4 : 6}
              tickLine={false}
              axisLine={{ stroke: "#8da2b3", strokeWidth: 1 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#495967"
              tickFormatter={(value) => formatCurrencyAxis(Number(value))}
              width={rightAxisWidth}
              fontSize={isNarrowViewport ? 10 : 12}
              tickCount={isNarrowViewport ? 4 : 6}
              tickLine={false}
              axisLine={{ stroke: "#8da2b3", strokeWidth: 1 }}
            />
            <Tooltip content={<ChartTooltip primaryMetricLabel={primaryMetricLabel} />} />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="spend"
              fill={`url(#${spendGradientId})`}
              stroke="none"
              isAnimationActive={!isPdf}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="results"
              fill={`url(#${resultsGradientId})`}
              stroke="none"
              isAnimationActive={!isPdf}
            />
            <Line
              yAxisId="left"
              dataKey="results"
              name={primaryMetricLabel}
              type="monotone"
              stroke="#003A4D"
              strokeWidth={3}
              dot={showDots ? { r: 2.5, fill: "#003A4D", stroke: "#ffffff", strokeWidth: 1.5 } : false}
              activeDot={{ r: 5, fill: "#003A4D", stroke: "#ffffff", strokeWidth: 2 }}
              isAnimationActive={!isPdf}
            />
            <Line
              yAxisId="right"
              dataKey="spend"
              name="Investimento"
              type="monotone"
              stroke="#0f766e"
              strokeWidth={2.8}
              dot={showDots ? { r: 2.5, fill: "#0f766e", stroke: "#ffffff", strokeWidth: 1.5 } : false}
              activeDot={{ r: 5, fill: "#0f766e", stroke: "#ffffff", strokeWidth: 2 }}
              isAnimationActive={!isPdf}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      </div>
      {showLegend ? (
        <div
          className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs text-slate-700 ${
            isPdf ? "mt-2 pb-0.5" : "mt-3"
          }`}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1">
            <span className="inline-block h-[2px] w-4 rounded bg-[#003A4D]" />
            {primaryMetricLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1">
            <span className="inline-block h-[2px] w-4 rounded bg-[#0f766e]" />
            Investimento
          </span>
        </div>
      ) : null}
    </div>
  );
}
