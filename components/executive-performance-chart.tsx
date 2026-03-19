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

type ExecutivePerformanceChartProps = {
  data: DailyMetricPoint[];
};

type TooltipProps = {
  active?: boolean;
  payload?: Array<{
    payload: DailyMetricPoint;
  }>;
};

function ChartTooltip({ active, payload }: TooltipProps) {
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
            Ações no Obj.: <span className="font-semibold text-ink">{formatNumberBR(point.results, 0, 2)}</span>
          </span>
        </li>
        <li className="flex items-center gap-1.5 text-slate-600">
          <Wallet size={12} className="text-teal-700" />
          <span>
            Investimento: <span className="font-semibold text-ink">{formatCurrencyBRL(point.spend)}</span>
          </span>
        </li>
      </ul>
    </div>
  );
}

export function ExecutivePerformanceChart({
  data
}: ExecutivePerformanceChartProps) {
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
  const chartBottomMargin = isNarrowViewport ? 18 : 10;
  const chartLeftMargin = isNarrowViewport ? 0 : 6;
  const chartRightMargin = isNarrowViewport ? 0 : 8;
  const showDots = !isNarrowViewport || data.length <= 14;

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
      className={`w-full rounded-xl border border-viasoft/20 bg-gradient-to-b from-[#f9fcff] via-white to-[#f6fbff] min-h-[380px] p-3 sm:p-4`}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="rounded-lg border border-viasoft/20 bg-viasoft/5 px-2.5 py-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-viasoft/80">
            Ações Consolidadas (Multi-objetivo)
          </p>
          <p className="text-sm font-semibold text-viasoft">{formatNumberBR(totalResults, 0, 2)}</p>
        </div>
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-teal-800">
            Investimento Consolidado
          </p>
          <p className="text-sm font-semibold text-teal-800">{formatCurrencyBRL(totalSpend)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Pico de Investimento Diário
          </p>
          <p className="text-sm font-semibold text-slate-700">
            {formatCurrencyBRL(peakSpend)}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200/90 bg-white/85 p-2.5 sm:p-3">
        <div className={isNarrowViewport ? "h-[300px]" : "h-[340px]"}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{
              top: 10,
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
            height={isNarrowViewport ? 28 : 32}
            tickMargin={6}
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
          <Tooltip content={<ChartTooltip />} />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="spend"
            fill={`url(#${spendGradientId})`}
            stroke="none"
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="results"
            fill={`url(#${resultsGradientId})`}
            stroke="none"
          />
          <Line
            yAxisId="left"
            dataKey="results"
            name="Ações (Multi-objetivo)"
            type="monotone"
            stroke="#003A4D"
            strokeWidth={3}
            dot={showDots ? { r: 2.5, fill: "#003A4D", stroke: "#ffffff", strokeWidth: 1.5 } : false}
            activeDot={{ r: 5, fill: "#003A4D", stroke: "#ffffff", strokeWidth: 2 }}
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
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs text-slate-700 mt-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1">
          <span className="inline-block h-[2px] w-4 rounded bg-[#003A4D]" />
          Ações Consolidadas
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1">
          <span className="inline-block h-[2px] w-4 rounded bg-[#0f766e]" />
          Investimento Consolidado
        </span>
      </div>
    </div>
  );
}
