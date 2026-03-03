"use client";

import { Coins, Percent, Target, Wallet } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
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
      <p className="inline-flex items-center gap-1.5 text-slate-600">
        <Target size={12} className="text-viasoft" />
        <span>
          {primaryMetricLabel}: <span className="font-semibold text-ink">{formatNumberBR(point.results, 0, 2)}</span>
        </span>
      </p>
      <p className="inline-flex items-center gap-1.5 text-slate-600">
        <Wallet size={12} className="text-teal-700" />
        <span>
          Investimento: <span className="font-semibold text-ink">{formatCurrencyBRL(point.spend)}</span>
        </span>
      </p>
      <p className="inline-flex items-center gap-1.5 text-slate-600">
        <Percent size={12} className="text-indigo-700" />
        <span>
          CTR: <span className="font-semibold text-ink">{formatPercentBR(point.ctr)}</span>
        </span>
      </p>
      <p className="inline-flex items-center gap-1.5 text-slate-600">
        <Coins size={12} className="text-amber-700" />
        <span>
          CPC: <span className="font-semibold text-ink">{formatCurrencyBRL(point.cpc)}</span>
        </span>
      </p>
    </div>
  );
}

export function PerformanceChart({
  data,
  primaryMetricLabel,
  isPdf = false
}: PerformanceChartProps) {
  const xAxisInterval = data.length >= 28 ? 3 : data.length >= 14 ? 1 : 0;

  return (
    <div className={`w-full rounded-xl border border-viasoft/15 bg-white ${isPdf ? "min-h-[266px] p-3" : "min-h-[320px] p-4"}`}>
      <div className={isPdf ? "h-[190px]" : "h-[252px]"}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{
              top: isPdf ? 8 : 10,
              right: 20,
              left: 12,
              bottom: isPdf ? 24 : 10
            }}
          >
            <CartesianGrid strokeDasharray="4 4" stroke="#cfdbe2" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateShortBR}
              stroke="#495967"
              fontSize={12}
              minTickGap={18}
              interval={xAxisInterval}
            />
            <YAxis
              yAxisId="left"
              stroke="#495967"
              tickFormatter={(value) => formatNumberBR(Number(value), 0, 0)}
              width={74}
              fontSize={12}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#495967"
              tickFormatter={(value) => formatCurrencyBRL(Number(value))}
              width={96}
              fontSize={12}
            />
            <Tooltip content={<ChartTooltip primaryMetricLabel={primaryMetricLabel} />} />
            <Line
              yAxisId="left"
              dataKey="results"
              name={primaryMetricLabel}
              stroke="#003A4D"
              strokeWidth={2.8}
              dot={{ r: 2.5, fill: "#003A4D", stroke: "#ffffff", strokeWidth: 1.5 }}
              activeDot={{ r: 5, fill: "#003A4D", stroke: "#ffffff", strokeWidth: 2 }}
              isAnimationActive={!isPdf}
            />
            <Line
              yAxisId="right"
              dataKey="spend"
              name="Investimento"
              stroke="#0f766e"
              strokeWidth={2.6}
              dot={{ r: 2.5, fill: "#0f766e", stroke: "#ffffff", strokeWidth: 1.5 }}
              activeDot={{ r: 5, fill: "#0f766e", stroke: "#ffffff", strokeWidth: 2 }}
              isAnimationActive={!isPdf}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className={`${isPdf ? "mt-3.5 pb-0.5" : "mt-3"} flex items-center justify-center gap-4 text-xs text-slate-700`}>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-[2px] w-4 rounded bg-[#003A4D]" />
          {primaryMetricLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-[2px] w-4 rounded bg-[#0f766e]" />
          Investimento
        </span>
      </div>
    </div>
  );
}
