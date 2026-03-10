"use client";

import {
  CircleAlert,
  Coins,
  Eye,
  Layers,
  Megaphone,
  MousePointerClick,
  Percent,
  TrendingUp,
  Wallet
} from "lucide-react";
import type { ObjectiveCategory, StructureComparisonPayload } from "@/lib/types";
import { formatCurrencyBRL, formatNumberBR, formatPercentBR } from "@/utils/formatters";

type StructureComparisonSectionProps = {
  entityType: "ADSET" | "AD";
  selectedIds: string[];
  resolveName: (id: string) => string;
  comparison: StructureComparisonPayload | null;
  loading: boolean;
  errorMessage?: string;
  retryInSeconds?: number | null;
};

type MetricKey = "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "results";

type MetricConfig = {
  key: MetricKey;
  label: string;
  icon: React.ReactNode;
  formatValue: (value: number | null) => string;
  getValue: (item: StructureComparisonPayload["items"][number]) => number | null;
};

function getPrimaryMetricKey(objective: ObjectiveCategory): MetricKey {
  switch (objective) {
    case "TRAFFIC":
      return "clicks";
    case "RECOGNITION":
      return "impressions";
    case "ENGAGEMENT":
    case "CONVERSIONS":
    default:
      return "results";
  }
}

function getResultsLabel(objective: ObjectiveCategory): string {
  if (objective === "ENGAGEMENT") {
    return "Interações com o anúncio";
  }

  return "Resultados da campanha";
}

function getMetrics(objective: ObjectiveCategory): MetricConfig[] {
  const metrics: MetricConfig[] = [
    {
      key: "spend",
      label: "Valor investido",
      icon: <Wallet size={15} />,
      formatValue: (value) => formatCurrencyBRL(value),
      getValue: (item) => item.current.spend
    },
    {
      key: "impressions",
      label: "Visualizações do anúncio",
      icon: <Eye size={15} />,
      formatValue: (value) => formatNumberBR(value, 0, 0),
      getValue: (item) => item.current.impressions
    },
    {
      key: "clicks",
      label: "Cliques no anúncio",
      icon: <MousePointerClick size={15} />,
      formatValue: (value) => formatNumberBR(value, 0, 0),
      getValue: (item) => item.current.clicks
    },
    {
      key: "ctr",
      label: "Taxa de cliques",
      icon: <Percent size={15} />,
      formatValue: (value) => formatPercentBR(value),
      getValue: (item) => item.current.ctr
    },
    {
      key: "cpc",
      label: "Custo por clique",
      icon: <Coins size={15} />,
      formatValue: (value) => formatCurrencyBRL(value),
      getValue: (item) => item.current.cpc
    },
    {
      key: "results",
      label: getResultsLabel(objective),
      icon: <TrendingUp size={15} />,
      formatValue: (value) => formatNumberBR(value, 0, 2),
      getValue: (item) => item.current.results
    }
  ];

  const primaryMetric = getPrimaryMetricKey(objective);
  return [
    ...metrics.filter((metric) => metric.key === primaryMetric),
    ...metrics.filter((metric) => metric.key !== primaryMetric)
  ];
}

function getEntityTitle(entityType: "ADSET" | "AD"): string {
  return entityType === "ADSET"
    ? "Comparativo entre grupos de anúncios"
    : "Comparativo entre anúncios";
}

function getEntityHint(entityType: "ADSET" | "AD"): string {
  return entityType === "ADSET"
    ? "Marque até 2 grupos na seção de estrutura para comparar lado a lado."
    : "Marque até 2 anúncios na seção de estrutura para comparar lado a lado.";
}

export function StructureComparisonSection({
  entityType,
  selectedIds,
  resolveName,
  comparison,
  loading,
  errorMessage,
  retryInSeconds = null
}: StructureComparisonSectionProps) {
  const selectedCount = selectedIds.length;
  const title = getEntityTitle(entityType);
  const hint = getEntityHint(entityType);
  const canRenderComparison = !loading && !errorMessage && comparison && comparison.items.length === 2;
  const metrics = canRenderComparison ? getMetrics(comparison.objectiveCategory) : [];
  const primaryMetricKey = canRenderComparison
    ? getPrimaryMetricKey(comparison.objectiveCategory)
    : null;
  const isReadyToCompare = selectedCount === 2;
  const firstItemName = selectedIds[0] ? resolveName(selectedIds[0]) : "";
  const secondItemName = selectedIds[1] ? resolveName(selectedIds[1]) : "";

  return (
    <section className="surface-panel border border-viasoft/15 bg-gradient-to-b from-white to-viasoft/5 p-5 sm:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-viasoft">
            <span className="inline-flex size-7 items-center justify-center rounded-lg bg-viasoft/10 text-viasoft">
              {entityType === "ADSET" ? <Layers size={16} /> : <Megaphone size={16} />}
            </span>
            {title}
          </h3>
          <p className="mt-1 text-sm text-slate-600">{hint}</p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
            isReadyToCompare
              ? "border-viasoft/35 bg-viasoft/10 text-viasoft"
              : "border-viasoft/20 bg-viasoft/5 text-viasoft"
          }`}
        >
          Seleções: {selectedCount}/2
        </span>
      </header>

      {selectedCount < 2 ? (
        <div className="inline-flex items-start gap-2 rounded-xl border border-dashed border-slate-300 bg-white/70 px-3 py-2 text-sm text-slate-600">
          <CircleAlert size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <p>Selecione mais 1 item para iniciar o comparativo.</p>
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
        </div>
      ) : null}

      {!loading && errorMessage ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      {!loading && retryInSeconds !== null && retryInSeconds > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Nova tentativa automática em {retryInSeconds}s.
        </div>
      ) : null}

      {canRenderComparison && comparison.isContingencySnapshot ? (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {comparison.contingencyReason ??
            "Dados em contingência: exibindo último snapshot disponível para comparação."}
        </div>
      ) : null}

      {canRenderComparison ? (
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {metrics.map((metric) => {
            const firstItem = comparison.items[0];
            const secondItem = comparison.items[1];
            const firstValue = metric.getValue(firstItem) ?? 0;
            const secondValue = metric.getValue(secondItem) ?? 0;
            const maxValue = Math.max(firstValue, secondValue, 1);
            const firstBarWidth = Math.max((firstValue / maxValue) * 100, firstValue > 0 ? 6 : 0);
            const secondBarWidth = Math.max((secondValue / maxValue) * 100, secondValue > 0 ? 6 : 0);
            const isPrimary = metric.key === primaryMetricKey;

            return (
              <article
                key={metric.key}
                className={`rounded-xl border p-3 ${
                  isPrimary
                    ? "border-viasoft/35 bg-viasoft/10 ring-1 ring-viasoft/20"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-viasoft">
                    {metric.icon}
                    {metric.label}
                  </p>
                  {isPrimary ? (
                    <span className="rounded-full border border-viasoft/25 bg-viasoft/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-viasoft">
                      KPI principal
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 space-y-2.5">
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="line-clamp-1 font-semibold text-viasoft">{firstItemName}</span>
                      <span className="font-medium text-slate-700">
                        {metric.formatValue(metric.getValue(firstItem))}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-viasoft shadow-[0_0_0_1px_rgba(0,58,77,0.18)]"
                        style={{ width: `${Math.min(firstBarWidth, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="line-clamp-1 font-semibold text-viasoft">{secondItemName}</span>
                      <span className="font-medium text-slate-700">
                        {metric.formatValue(metric.getValue(secondItem))}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-viasoft/55 shadow-[0_0_0_1px_rgba(0,58,77,0.14)]"
                        style={{ width: `${Math.min(secondBarWidth, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
