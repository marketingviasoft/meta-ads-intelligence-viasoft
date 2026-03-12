"use client";

import {
  Coins,
  Eye,
  LineChart,
  Megaphone,
  MousePointerClick,
  Percent,
  Plus,
  TrendingUp,
  Wallet
} from "lucide-react";
import type { ReactNode } from "react";
import type { DailyMetricPoint, DashboardPayload } from "@/lib/types";
import { InsightsPanel } from "@/components/insights-panel";
import { MetricCard } from "@/components/metric-card";
import { PerformanceChart } from "@/components/performance-chart";
import { TrendCard } from "@/components/trend-card";
import {
  formatCurrencyBRL,
  formatDateLongBR,
  formatNumberBR,
  formatPercentBR
} from "@/utils/formatters";

type DashboardReportProps = {
  data: DashboardPayload;
  isPdf?: boolean;
  hideCampaignHeader?: boolean;
};

type MetricKey = "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "results";

type MetricCardConfig = {
  metricKey: MetricKey;
  title: string;
  description: string;
  value: string;
  icon: ReactNode;
  previousValue: string;
  deltaAbsolute: number | null;
  deltaPercent: number | null;
  inverse?: boolean;
};

type CampaignHeaderCardProps = {
  campaign: DashboardPayload["campaign"];
  range: DashboardPayload["range"];
  isPdf?: boolean;
};

function getObjectiveLabel(category: DashboardPayload["campaign"]["objectiveCategory"]): string {
  switch (category) {
    case "TRAFFIC":
      return "Tráfego";
    case "ENGAGEMENT":
      return "Engajamento";
    case "RECOGNITION":
      return "Reconhecimento";
    case "CONVERSIONS":
      return "Conversão";
    default:
      return "Campanha";
  }
}

function getDeliveryStatusLabel(status: DashboardPayload["campaign"]["deliveryGroup"]): string {
  switch (status) {
    case "ACTIVE":
      return "Ativa";
    case "PAUSED":
      return "Pausada";
    case "WITH_ISSUES":
      return "Com problemas";
    case "PENDING_REVIEW":
      return "Em análise";
    case "ARCHIVED":
      return "Arquivada";
    default:
      return "Status não mapeado";
  }
}

function getDeliveryStatusTone(status: DashboardPayload["campaign"]["deliveryGroup"]): string {
  switch (status) {
    case "ACTIVE":
      return "border-green-200 bg-green-50 text-green-700";
    case "PAUSED":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "WITH_ISSUES":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "PENDING_REVIEW":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "ARCHIVED":
      return "border-slate-300 bg-slate-100 text-slate-700";
    default:
      return "border-slate-300 bg-slate-100 text-slate-700";
  }
}

function getPrimaryMetricKey(category: DashboardPayload["campaign"]["objectiveCategory"]): MetricKey {
  switch (category) {
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

function getResultsCardCopy(category: DashboardPayload["campaign"]["objectiveCategory"]): {
  title: string;
  description: string;
} {
  switch (category) {
    case "ENGAGEMENT":
      return {
        title: "Interações com o anúncio",
        description: "Curtidas, comentários ou compartilhamentos"
      };
    case "CONVERSIONS":
      return {
        title: "Resultados da campanha",
        description: "Conversões registradas no período"
      };
    default:
      return {
        title: "Resultados da campanha",
        description: "Resultados registrados no período"
      };
  }
}

function parseIsoDateUtc(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatIsoDateUtc(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fillMissingChartDates(
  chart: DailyMetricPoint[],
  since: string,
  until: string,
  expectedDays: number
): DailyMetricPoint[] {
  const lookup = new Map(chart.map((point) => [point.date, point]));
  const complete: DailyMetricPoint[] = [];

  const cursor = parseIsoDateUtc(since);
  const end = parseIsoDateUtc(until);

  while (cursor <= end) {
    const date = formatIsoDateUtc(cursor);
    const point = lookup.get(date);

    complete.push(
      point ?? {
        date,
        spend: 0,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        cpc: 0,
        results: 0,
        costPerResult: 0
      }
    );

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (complete.length === expectedDays) {
    return complete;
  }

  const normalized: DailyMetricPoint[] = [];
  const fallbackEnd = parseIsoDateUtc(until);

  for (let offset = expectedDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(fallbackEnd);
    date.setUTCDate(fallbackEnd.getUTCDate() - offset);
    const isoDate = formatIsoDateUtc(date);
    const point = lookup.get(isoDate);

    normalized.push(
      point ?? {
        date: isoDate,
        spend: 0,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        cpc: 0,
        results: 0,
        costPerResult: 0
      }
    );
  }

  return normalized;
}

function getBudgetProgressTone(utilizationPercent: number): string {
  if (utilizationPercent >= 100) {
    return "text-rose";
  }

  if (utilizationPercent >= 85) {
    return "text-amber";
  }

  return "text-emerald";
}

const META_INVESTMENT_TAX_RATE = 0.1215;

type VerticalBudgetSummaryPanelProps = {
  verticalBudget: DashboardPayload["verticalBudget"];
  isPdf?: boolean;
};

export function VerticalBudgetSummaryPanel({ verticalBudget, isPdf = false }: VerticalBudgetSummaryPanelProps) {
  const taxAmount = verticalBudget.spentInMonth * META_INVESTMENT_TAX_RATE;
  const totalWithTax = verticalBudget.spentInMonth + taxAmount;
  const totalCapWithTax = verticalBudget.monthlyCap * (1 + META_INVESTMENT_TAX_RATE);
  const remainingTotal = Math.max(totalCapWithTax - totalWithTax, 0);
  const overTotal = Math.max(totalWithTax - totalCapWithTax, 0);
  const isOverBudget = overTotal > 0;
  const remainingLabel = isOverBudget ? "Excedente no mês" : "Saldo disponível no mês";
  const remainingValue = isOverBudget ? overTotal : remainingTotal;
  const totalUtilizationPercent =
    totalCapWithTax > 0 ? (totalWithTax / totalCapWithTax) * 100 : 0;
  const investmentUtilizationPercent =
    totalCapWithTax > 0 ? (verticalBudget.spentInMonth / totalCapWithTax) * 100 : 0;
  const clampedTotalUtilization = Math.max(0, Math.min(totalUtilizationPercent, 100));
  const clampedInvestmentUtilization = Math.max(0, Math.min(investmentUtilizationPercent, 100));
  const progressTextTone = getBudgetProgressTone(totalUtilizationPercent);
  const investmentMinWidthPx = verticalBudget.spentInMonth > 0 ? 10 : 0;
  const totalMinWidthPx = totalWithTax > 0 ? 10 : 0;
  const dataUntilSuffix = verticalBudget.includesCurrentDay ? " (hoje, parcial)" : "";
  const titleValueClass = isPdf ? "mt-1 text-3xl font-semibold leading-none text-ink" : "mt-1 text-4xl font-semibold leading-none text-ink";
  const secondaryValueClass = isPdf
    ? `mt-1 text-3xl font-semibold leading-none ${isOverBudget ? "text-rose" : "text-emerald"}`
    : `mt-1 text-4xl font-semibold leading-none ${isOverBudget ? "text-rose" : "text-emerald"}`;

  return (
    <div className={`rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/70 ${isPdf ? "p-3" : "p-4"}`}>
      <div className={`grid ${isPdf ? "gap-2.5 md:grid-cols-2" : "gap-3 md:grid-cols-2"}`}>
        <div className="flex h-full flex-col rounded-xl border border-viasoft/15 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-viasoft">
            Investimento da vertical no mês atual (com imposto)
          </p>
          <p className={titleValueClass}>{formatCurrencyBRL(totalWithTax)}</p>
          <div className={`mt-auto space-y-0.5 ${isPdf ? "pt-1.5 text-[11px]" : "pt-2 text-xs"} text-slate-600`}>
            <p>
              Ciclo de faturamento Meta: {formatDateLongBR(verticalBudget.monthSince)} até{" "}
              {formatDateLongBR(verticalBudget.monthUntil)}.
            </p>
            <p>
              Acumulado até {formatDateLongBR(verticalBudget.dataUntil)}
              {dataUntilSuffix}.
            </p>
          </div>
        </div>

        <div
          className={`flex h-full flex-col rounded-xl border p-3 ${
            isOverBudget ? "border-rose-200 bg-rose-50/70" : "border-emerald-200 bg-emerald-50/60"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-viasoft">
            {remainingLabel}
          </p>
          <p className={secondaryValueClass}>{formatCurrencyBRL(remainingValue)}</p>
          <p className={`mt-auto ${isPdf ? "pt-1.5 text-[11px]" : "pt-2 text-xs"} text-slate-600`}>
            Teto total do ciclo: {formatCurrencyBRL(totalCapWithTax)}
          </p>
        </div>
      </div>

      <div className={`grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch ${isPdf ? "mt-2.5" : "mt-3"}`}>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
            Valor aplicado em campanhas
          </p>
          <p className="mt-1 text-sm font-semibold text-ink">{formatCurrencyBRL(verticalBudget.spentInMonth)}</p>
        </div>

        <div className="flex items-center justify-center">
          <span className="inline-flex size-7 items-center justify-center rounded-full border border-viasoft/20 bg-viasoft/10 text-viasoft">
            <Plus size={14} />
          </span>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Imposto (12,15%)</p>
          <p className="mt-1 text-sm font-semibold text-ink">{formatCurrencyBRL(taxAmount)}</p>
        </div>
      </div>

      <div className={`rounded-xl border border-slate-200 bg-white p-3 ${isPdf ? "mt-2.5" : "mt-3"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <p className={`font-semibold ${progressTextTone}`}>
            Consumo do teto total: {formatPercentBR(totalUtilizationPercent, 1)}
          </p>
          <p className="font-medium text-slate-500">
            Referência de teto: {formatCurrencyBRL(totalCapWithTax)}
          </p>
        </div>
        <div className="relative mt-2 h-3.5 w-full overflow-hidden rounded-full border border-[#c9d7e1] bg-[#e3edf4]">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[#5cb3a6]/70"
            style={{
              width: `${clampedTotalUtilization}%`,
              minWidth: `${totalMinWidthPx}px`
            }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[#0f766e]"
            style={{
              width: `${clampedInvestmentUtilization}%`,
              minWidth: `${investmentMinWidthPx}px`
            }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
          <span>{formatCurrencyBRL(0)}</span>
          <span>{formatCurrencyBRL(totalCapWithTax)}</span>
        </div>
        <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 ${isPdf ? "mt-1.5" : "mt-2"}`}>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#0f766e]" />
            Valor investido
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#5cb3a6]/70" />
            Investido + 12,15% de imposto
          </span>
        </div>
      </div>
    </div>
  );
}

export function CampaignHeaderCard({
  campaign,
  range,
  isPdf = false
}: CampaignHeaderCardProps) {
  return (
    <div
      data-dashboard-block="campaign-info"
      className={`surface-panel bg-gradient-to-br from-viasoft/10 via-white to-white p-5 ${isPdf ? "pdf-block" : ""}`}
    >
      <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold text-viasoft">
          <Megaphone size={17} className="text-viasoft" />
          Informações da campanha
        </h3>
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${getDeliveryStatusTone(
            campaign.deliveryGroup
          )}`}
        >
          {getDeliveryStatusLabel(campaign.deliveryGroup)}
        </span>
      </header>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-viasoft">{campaign.name}</h2>
          <p className="mt-1 text-sm text-slate-600">
            Objetivo: {getObjectiveLabel(campaign.objectiveCategory)}
          </p>
        </div>
        <p className="text-sm text-slate-600">
          Período atual: {formatDateLongBR(range.since)} até {formatDateLongBR(range.until)}
        </p>
      </div>
    </div>
  );
}

export function DashboardReport({ data, isPdf = false, hideCampaignHeader = false }: DashboardReportProps) {
  const { campaign, range, comparison } = data;
  const deltas = comparison.deltas;
  const completeChartData = fillMissingChartDates(data.chart, range.since, range.until, range.days);
  const primaryMetricKey = getPrimaryMetricKey(campaign.objectiveCategory);
  const resultsCardCopy = getResultsCardCopy(campaign.objectiveCategory);
  const previousHasData =
    (Number.isFinite(comparison.previous.spend) && comparison.previous.spend > 0) ||
    (Number.isFinite(comparison.previous.impressions) && comparison.previous.impressions > 0) ||
    (Number.isFinite(comparison.previous.clicks) && comparison.previous.clicks > 0);
  const noPrevData = !previousHasData;
  const metricCards: MetricCardConfig[] = [
    {
      metricKey: "spend",
      title: "Valor investido",
      description: "Total aplicado na campanha no período",
      value: formatCurrencyBRL(comparison.current.spend),
      icon: <Wallet size={16} />,
      previousValue: formatCurrencyBRL(comparison.previous.spend),
      deltaAbsolute: deltas.spend.absolute,
      deltaPercent: deltas.spend.percent
    },
    {
      metricKey: "impressions",
      title: "Visualizações do anúncio",
      description: "Quantidade de vezes que o anúncio foi exibido",
      value: formatNumberBR(comparison.current.impressions, 0, 0),
      icon: <Eye size={16} />,
      previousValue: formatNumberBR(comparison.previous.impressions, 0, 0),
      deltaAbsolute: deltas.impressions.absolute,
      deltaPercent: deltas.impressions.percent
    },
    {
      metricKey: "clicks",
      title: "Cliques no anúncio",
      description: "Quantidade de pessoas que clicaram",
      value: formatNumberBR(comparison.current.clicks, 0, 0),
      icon: <MousePointerClick size={16} />,
      previousValue: formatNumberBR(comparison.previous.clicks, 0, 0),
      deltaAbsolute: deltas.clicks.absolute,
      deltaPercent: deltas.clicks.percent
    },
    {
      metricKey: "ctr",
      title: "Taxa de cliques",
      description: "Percentual de visualizações que viraram cliques",
      value: formatPercentBR(comparison.current.ctr),
      icon: <Percent size={16} />,
      previousValue: formatPercentBR(comparison.previous.ctr),
      deltaAbsolute: deltas.ctr.absolute,
      deltaPercent: deltas.ctr.percent
    },
    {
      metricKey: "cpc",
      title: "Custo por clique",
      description: "Valor médio pago por clique",
      value: formatCurrencyBRL(comparison.current.cpc),
      icon: <Coins size={16} />,
      previousValue: formatCurrencyBRL(comparison.previous.cpc),
      deltaAbsolute: deltas.cpc.absolute,
      deltaPercent: deltas.cpc.percent,
      inverse: true
    },
    {
      metricKey: "results",
      title: resultsCardCopy.title,
      description: resultsCardCopy.description,
      value: formatNumberBR(comparison.current.results, 0, 2),
      icon: <TrendingUp size={16} />,
      previousValue: formatNumberBR(comparison.previous.results, 0, 2),
      deltaAbsolute: deltas.results.absolute,
      deltaPercent: deltas.results.percent
    }
  ];
  const orderedMetricCards = [
    ...metricCards.filter((card) => card.metricKey === primaryMetricKey),
    ...metricCards.filter((card) => card.metricKey !== primaryMetricKey)
  ];

  return (
    <section className={isPdf ? "space-y-3" : "space-y-4"}>
      {!hideCampaignHeader ? (
        <CampaignHeaderCard
          campaign={campaign}
          range={range}
          isPdf={isPdf}
        />
      ) : null}

      {noPrevData ? (
        <div className={`surface-panel bg-gradient-to-b from-amber-100/70 to-amber-50 p-4 text-sm text-amber-900 ${isPdf ? "pdf-block" : ""}`}>
          Sem comparação: a campanha não teve entrega no período anterior equivalente (início recente ou sem veiculação).
        </div>
      ) : null}

      <div
        data-dashboard-block="metrics"
        className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ${isPdf ? "pdf-block gap-2.5" : ""}`}
      >
        {orderedMetricCards.map((card) => (
          <MetricCard
            key={card.metricKey}
            metricKey={card.metricKey}
            title={card.title}
            description={card.description}
            value={card.value}
            icon={card.icon}
            previousValue={card.previousValue}
            deltaAbsolute={card.deltaAbsolute}
            deltaPercent={card.deltaPercent}
            noPrevData={noPrevData}
            inverse={card.inverse}
            highlighted={card.metricKey === primaryMetricKey}
          />
        ))}
      </div>

      <div data-dashboard-block="trend">
        <TrendCard
          direction={comparison.trend.direction}
          costPerResult={comparison.current.costPerResult}
          objectiveCategory={campaign.objectiveCategory}
          resultsDeltaPercent={comparison.deltas.results.percent}
          ctrDeltaPercent={comparison.deltas.ctr.percent}
          impressionsDeltaPercent={comparison.deltas.impressions.percent}
          clicksDeltaPercent={comparison.deltas.clicks.percent}
          cpcDeltaPercent={comparison.deltas.cpc.percent}
          costPerResultDeltaPercent={comparison.deltas.costPerResult.percent}
          currentImpressions={comparison.current.impressions}
          currentClicks={comparison.current.clicks}
          currentResults={comparison.current.results}
          previousResults={comparison.previous.results}
          isPdf={isPdf}
        />
      </div>

      <div
        data-dashboard-block="daily-performance"
        className={`surface-panel relative overflow-hidden border border-viasoft/15 bg-white p-5 ${isPdf ? "pdf-block" : ""}`}
      >
        <h3 className="flex items-center gap-2 text-base font-semibold text-viasoft">
          <LineChart size={17} className="text-viasoft" />
          Performance diária
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Comparativo visual de {comparison.current.primaryMetricLabel.toLowerCase()} e investimento no período atual.
        </p>
        <div className="mt-4">
          <PerformanceChart
            data={completeChartData}
            primaryMetricLabel={comparison.current.primaryMetricLabel}
            isPdf={isPdf}
          />
        </div>
      </div>

      <InsightsPanel insights={data.insights} recommendations={data.recommendations} isPdf={isPdf} />
    </section>
  );
}
