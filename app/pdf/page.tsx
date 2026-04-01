import {
  Layers,
  Layers3,
  Megaphone,
  MousePointerClick,
  Coins,
  Eye,
  Percent,
  TrendingUp,
  Wallet
} from "lucide-react";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { VerticalBudgetSummaryPanel } from "@/components/dashboard-report";
import { InsightsPanel } from "@/components/insights-panel";
import { MetricCard } from "@/components/metric-card";
import { PerformanceChart } from "@/components/performance-chart";
import { PdfReadyFlag } from "@/components/pdf-ready-flag";
import { TrendCard } from "@/components/trend-card";
import {
  getAdSetAdsFromStore,
  getCampaignAdSetsFromStore,
  getCampaignCatalogFromStore,
  getDashboardPayloadFromStore,
  getStructureComparisonPayloadFromStore,
  getVerticalBudgetSummaryFromStore
} from "@/lib/meta-insights-store";
import { resolvePdfPagePlan } from "@/lib/pdf-page-plan";
import { PDF_BRAND_SIGNATURE } from "@/pdf/layout-preset";
import type {
  DailyMetricPoint,
  DashboardPayload,
  ObjectiveCategory,
  StructureComparisonEntityType,
  StructureComparisonPayload
} from "@/lib/types";
import { resolveSupportedVertical } from "@/lib/verticals";
import { parseRangeDays } from "@/utils/date-range";
import { formatCurrencyBRL, formatNumberBR, formatPercentBR } from "@/utils/formatters";
import { getDeliveryFilterLabel } from "@/utils/labels";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type MetricKey = "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "results";
type ComparisonMetricKey = MetricKey;

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

type ComparisonMetricConfig = {
  key: ComparisonMetricKey;
  label: string;
  icon: ReactNode;
  formatValue: (value: number | null) => string;
  getValue: (item: StructureComparisonPayload["items"][number]) => number | null;
};

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
        description: "Qualquer interação com a publicação"
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

function PdfSelectorField({
  label,
  value,
  icon
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-viasoft">{label}</span>
      <div className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-ink">
        {icon ? (
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-viasoft/10 text-viasoft">
            {icon}
          </span>
        ) : null}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

function parseCsvIds(rawValue: string | undefined): string[] {
  if (!rawValue) {
    return [];
  }

  const ids = rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set(ids)];
}

function getComparisonPrimaryMetricKey(objective: ObjectiveCategory): ComparisonMetricKey {
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

function getComparisonResultsLabel(objective: ObjectiveCategory): string {
  if (objective === "ENGAGEMENT") {
    return "Interações com o anúncio";
  }

  return "Resultados da campanha";
}

function getComparisonMetrics(objective: ObjectiveCategory): ComparisonMetricConfig[] {
  const metrics: ComparisonMetricConfig[] = [
    {
      key: "spend",
      label: "Valor investido",
      icon: <Wallet size={14} />,
      formatValue: (value) => formatCurrencyBRL(value),
      getValue: (item) => item.current.spend
    },
    {
      key: "impressions",
      label: "Visualizações do anúncio",
      icon: <Eye size={14} />,
      formatValue: (value) => formatNumberBR(value, 0, 0),
      getValue: (item) => item.current.impressions
    },
    {
      key: "clicks",
      label: "Cliques no anúncio",
      icon: <MousePointerClick size={14} />,
      formatValue: (value) => formatNumberBR(value, 0, 0),
      getValue: (item) => item.current.clicks
    },
    {
      key: "ctr",
      label: "Taxa de cliques",
      icon: <Percent size={14} />,
      formatValue: (value) => formatPercentBR(value),
      getValue: (item) => item.current.ctr
    },
    {
      key: "cpc",
      label: "Custo por clique",
      icon: <Coins size={14} />,
      formatValue: (value) => formatCurrencyBRL(value),
      getValue: (item) => item.current.cpc
    },
    {
      key: "results",
      label: getComparisonResultsLabel(objective),
      icon: <TrendingUp size={14} />,
      formatValue: (value) => formatNumberBR(value, 0, 2),
      getValue: (item) => item.current.results
    }
  ];

  const primaryMetric = getComparisonPrimaryMetricKey(objective);
  return [
    ...metrics.filter((metric) => metric.key === primaryMetric),
    ...metrics.filter((metric) => metric.key !== primaryMetric)
  ];
}

function getComparisonTitle(entityType: StructureComparisonEntityType): string {
  return entityType === "ADSET" ? "Comparativo entre grupos de anúncios" : "Comparativo entre anúncios";
}

function PdfComparisonSection({
  entityType,
  comparison,
  selectedIds,
  nameById,
  errorMessage
}: {
  entityType: StructureComparisonEntityType;
  comparison: StructureComparisonPayload | null;
  selectedIds: string[];
  nameById: Map<string, string>;
  errorMessage?: string;
}) {
  if (selectedIds.length !== 2) {
    return null;
  }

  const metrics = comparison ? getComparisonMetrics(comparison.objectiveCategory) : [];
  const firstSelectedName = comparison ? nameById.get(comparison.items[0]?.id) ?? comparison.items[0]?.id : selectedIds[0];
  const secondSelectedName = comparison ? nameById.get(comparison.items[1]?.id) ?? comparison.items[1]?.id : selectedIds[1];

  return (
    <section
      data-pdf-block={entityType === "ADSET" ? "adset-comparison" : "ad-comparison"}
      className="surface-panel avoid-page-break p-4"
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <h3 className="pdf-section-title flex items-center gap-2 text-base font-semibold text-viasoft">
          {entityType === "ADSET" ? <Layers size={16} /> : <Megaphone size={16} />}
          {getComparisonTitle(entityType)}
        </h3>
        <span className="rounded-full border border-viasoft/25 bg-viasoft/10 px-2 py-0.5 text-xs font-semibold text-viasoft">
          Seleções: {selectedIds.length}/2
        </span>
      </header>

      {errorMessage ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      {!errorMessage && comparison ? (
        <div className="rounded-xl border border-slate-200 bg-white p-2.5">
          <div className="grid grid-cols-[minmax(0,0.75fr)_minmax(0,1.1fr)_minmax(0,1.1fr)] items-start gap-2 border-b border-slate-200 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            <span>Métrica</span>
            <span className="break-words text-viasoft">{firstSelectedName}</span>
            <span className="break-words text-viasoft">{secondSelectedName}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {metrics.map((metric) => {
              const firstItem = comparison.items[0];
              const secondItem = comparison.items[1];
              const isPrimary = metric.key === getComparisonPrimaryMetricKey(comparison.objectiveCategory);

              return (
                <div
                  key={metric.key}
                  className="grid grid-cols-[minmax(0,0.75fr)_minmax(0,1.1fr)_minmax(0,1.1fr)] items-start gap-2 py-1.5 text-[11px]"
                >
                  <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-viasoft">
                    {metric.icon}
                    <span className="break-words">{metric.label}</span>
                    {isPrimary ? (
                      <span className="shrink-0 rounded-full border border-viasoft/20 bg-viasoft/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-viasoft">
                        KPI
                      </span>
                    ) : null}
                  </span>
                  <span className="break-words font-semibold text-slate-800">
                    {metric.formatValue(metric.getValue(firstItem))}
                  </span>
                  <span className="break-words font-semibold text-slate-800">
                    {metric.formatValue(metric.getValue(secondItem))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PdfPageFooter({
  pageNumber,
  generatedAtLabel,
  totalPages,
  dockBottom = true
}: {
  pageNumber: number;
  generatedAtLabel: string;
  totalPages: number;
  dockBottom?: boolean;
}) {
  return (
    <footer
      className={`pdf-footer flex items-center justify-between gap-4 border-t border-viasoft/15 pt-3 text-[11px] text-slate-600 ${dockBottom ? "mt-auto" : "mt-3"}`}
    >
      <p className="inline-flex items-center gap-2">
        <span className="inline-flex size-5 items-center justify-center rounded-md bg-viasoft/10 text-viasoft">
          <BrandMark variant="icon" size={11} />
        </span>
        <span>{PDF_BRAND_SIGNATURE}</span>
      </p>
      <p>
        Página {pageNumber}/{totalPages} · Atualizado em {generatedAtLabel}
      </p>
    </footer>
  );
}

function formatGeneratedAtLabel(dateIso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(dateIso));
}

export default async function PdfPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const campaignFromQuery = Array.isArray(params.campaignId)
    ? params.campaignId[0]
    : params.campaignId;
  const verticalFromQuery = Array.isArray(params.verticalTag)
    ? params.verticalTag[0]
    : params.verticalTag;
  const deliveryFromQuery = Array.isArray(params.deliveryGroup)
    ? params.deliveryGroup[0]
    : params.deliveryGroup;
  const selectedAdSetFromQuery = Array.isArray(params.selectedAdSetId)
    ? params.selectedAdSetId[0]
    : params.selectedAdSetId;
  const compareAdSetIdsFromQuery = Array.isArray(params.compareAdSetIds)
    ? params.compareAdSetIds[0]
    : params.compareAdSetIds;
  const compareAdIdsFromQuery = Array.isArray(params.compareAdIds)
    ? params.compareAdIds[0]
    : params.compareAdIds;
  const rangeFromQuery = Array.isArray(params.rangeDays) ? params.rangeDays[0] : params.rangeDays;
  const rangeDays = parseRangeDays(rangeFromQuery);
  const selectedVerticalFromQuery = resolveSupportedVertical(verticalFromQuery ?? "");
  const deliveryLabel = getDeliveryFilterLabel(deliveryFromQuery);

  if (!campaignFromQuery && selectedVerticalFromQuery) {
    const verticalBudget = await getVerticalBudgetSummaryFromStore({
      verticalTag: selectedVerticalFromQuery
    });
    const generatedAtLabel = formatGeneratedAtLabel(new Date().toISOString());

    return (
      <main className="bg-white py-3 print:py-0">
        <PdfReadyFlag />
        <section className="pdf-shell mx-auto w-full print:max-w-none print:px-0 print:py-0">
          <div className="pdf-landscape-page gap-2" data-pdf-page="1">
            <header data-pdf-block="header" className="surface-panel p-6">
              <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-viasoft/20 bg-viasoft/5 px-2.5 py-1.5 text-viasoft">
                <span className="inline-flex size-6 items-center justify-center rounded-lg bg-viasoft text-white">
                  <BrandMark variant="icon" size={13} />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                  {PDF_BRAND_SIGNATURE}
                </span>
              </div>
              <h1 className="mt-1 text-3xl font-semibold text-viasoft">Performance executiva com dados do Meta</h1>
              <p className="mt-2 text-base text-slate-600">
                Relatório de investimento mensal da vertical selecionada.
              </p>
            </header>

            <section data-pdf-block="filters" className="surface-panel p-4">
            <div className="grid grid-cols-12 gap-3">
                <div className="col-span-2 min-w-0">
                  <PdfSelectorField
                    label="Vertical"
                    value={selectedVerticalFromQuery}
                    icon={<Layers3 size={14} className="text-viasoft" />}
                  />
                </div>
                <div className="col-span-2 min-w-0">
                  <PdfSelectorField label="Veiculação" value={deliveryLabel} />
                </div>
                <div className="col-span-6 min-w-0">
                  <PdfSelectorField label="Campanhas" value="Sem campanha selecionada" />
                </div>
                <div className="col-span-2 min-w-0">
                  <PdfSelectorField label="Período" value={`Últimos ${rangeDays} dias`} />
                </div>
              </div>
              <div data-pdf-block="vertical-budget" className="mt-4 border-t border-slate-200 pt-4">
                <VerticalBudgetSummaryPanel verticalBudget={verticalBudget} isPdf />
              </div>
            </section>

            <PdfPageFooter pageNumber={1} totalPages={1} generatedAtLabel={generatedAtLabel} />
          </div>
        </section>
      </main>
    );
  }

  const campaigns = await getCampaignCatalogFromStore(rangeDays, false);
  const campaignId = campaignFromQuery ?? campaigns[0]?.id;

  if (!campaignId) {
    return (
      <main className="mx-auto mt-6 max-w-3xl rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        Nenhuma campanha foi encontrada para renderizar o PDF.
      </main>
    );
  }

  let payload: DashboardPayload;
  try {
    payload = await getDashboardPayloadFromStore({
      campaignId,
      rangeDays
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao montar o relatório para PDF.";
    return (
      <main className="mx-auto mt-6 max-w-4xl rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        <PdfReadyFlag />
        {message}
      </main>
    );
  }
  const comparison = payload.comparison;
  const deltas = comparison.deltas;
  const completeChartData = fillMissingChartDates(
    payload.chart,
    payload.range.since,
    payload.range.until,
    payload.range.days
  );
  const primaryMetricKey = getPrimaryMetricKey(payload.campaign.objectiveCategory);
  const resultsCardCopy = getResultsCardCopy(payload.campaign.objectiveCategory);
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

  const adSets = await getCampaignAdSetsFromStore(campaignId, false);
  const selectedAdSetId =
    selectedAdSetFromQuery && adSets.some((adSet) => adSet.id === selectedAdSetFromQuery)
      ? selectedAdSetFromQuery
      : (adSets[0]?.id ?? "");
  const ads = selectedAdSetId ? await getAdSetAdsFromStore(selectedAdSetId, false) : [];
  const adSetIdSet = new Set(adSets.map((adSet) => adSet.id));
  const adIdSet = new Set(ads.map((ad) => ad.id));
  const selectedCompareAdSetIds = parseCsvIds(compareAdSetIdsFromQuery)
    .filter((id) => adSetIdSet.has(id))
    .slice(0, 2);
  const selectedCompareAdIds = parseCsvIds(compareAdIdsFromQuery)
    .filter((id) => adIdSet.has(id))
    .slice(0, 2);
  const hasAdSetComparisonSelection = selectedCompareAdSetIds.length === 2;
  const hasAdComparisonSelection = selectedCompareAdIds.length === 2;

  let adSetComparisonPayload: StructureComparisonPayload | null = null;
  let adComparisonPayload: StructureComparisonPayload | null = null;
  let adSetComparisonErrorMessage = "";
  let adComparisonErrorMessage = "";

  if (hasAdSetComparisonSelection) {
    try {
      adSetComparisonPayload = await getStructureComparisonPayloadFromStore({
        campaignId,
        entityType: "ADSET",
        entityIds: selectedCompareAdSetIds,
        rangeDays
      });
    } catch (error) {
      adSetComparisonErrorMessage =
        error instanceof Error ? error.message : "Falha ao montar comparativo entre grupos de anúncios.";
    }
  }

  if (hasAdComparisonSelection) {
    try {
      adComparisonPayload = await getStructureComparisonPayloadFromStore({
        campaignId,
        entityType: "AD",
        entityIds: selectedCompareAdIds,
        rangeDays
      });
    } catch (error) {
      adComparisonErrorMessage =
        error instanceof Error ? error.message : "Falha ao montar comparativo entre anúncios.";
    }
  }

  const {
    shouldRenderComparisonPage,
    totalPages,
    metricsPageNumber,
    trendPageNumber,
    insightsPageNumber
  } = resolvePdfPagePlan({
    hasAdSetComparisonSelection,
    hasAdComparisonSelection
  });
  const selectedVerticalLabel =
    selectedVerticalFromQuery ??
    (payload.campaign.verticalTag && payload.campaign.verticalTag !== "Sem vertical"
      ? payload.campaign.verticalTag
      : "Todas as verticais");
  const generatedAtLabel = formatGeneratedAtLabel(payload.generatedAt);
  const adSetNameById = new Map(adSets.map((adSet) => [adSet.id, adSet.name]));
  const adNameById = new Map(ads.map((ad) => [ad.id, ad.name]));

  return (
    <main className="bg-white py-3 print:py-0">
      <PdfReadyFlag />
      <section className="pdf-shell mx-auto w-full print:max-w-none print:px-0 print:py-0">
        <div className="pdf-landscape-page pdf-page-break-after" data-pdf-page="1">
          <header data-pdf-block="header" className="surface-panel p-6">
            <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-viasoft/20 bg-viasoft/5 px-2.5 py-1.5 text-viasoft">
              <span className="inline-flex size-6 items-center justify-center rounded-lg bg-viasoft text-white">
                <BrandMark variant="icon" size={13} />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                {PDF_BRAND_SIGNATURE}
              </span>
            </div>
            <h1 className="mt-1 text-3xl font-semibold text-viasoft">Performance executiva com dados do Meta</h1>
            <p className="mt-2 text-base text-slate-600">
              Períodos de performance excluem o dia atual e comparam automaticamente contra o período anterior equivalente.
            </p>
          </header>

          <section data-pdf-block="filters" className="surface-panel p-4">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-2 min-w-0">
                <PdfSelectorField
                  label="Vertical"
                  value={selectedVerticalLabel}
                  icon={<Layers3 size={14} className="text-viasoft" />}
                />
              </div>
              <div className="col-span-2 min-w-0">
                <PdfSelectorField label="Veiculação" value={deliveryLabel} />
              </div>
              <div className="col-span-6 min-w-0">
                <PdfSelectorField label="Campanhas" value={payload.campaign.name} />
              </div>
              <div className="col-span-2 min-w-0">
                <PdfSelectorField label="Período" value={`Últimos ${payload.range.days} dias`} />
              </div>
            </div>
            <div data-pdf-block="vertical-budget" className="mt-4 border-t border-slate-200 pt-4">
              {selectedVerticalFromQuery ? (
                <VerticalBudgetSummaryPanel verticalBudget={payload.verticalBudget} isPdf />
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Selecione uma vertical específica para visualizar o orçamento mensal.
                </div>
              )}
            </div>
          </section>

          <PdfPageFooter pageNumber={1} totalPages={totalPages} generatedAtLabel={generatedAtLabel} />
        </div>

        {shouldRenderComparisonPage ? (
          <div className="pdf-landscape-page pdf-page-break-after" data-pdf-page="2">
            <div className="space-y-3">
              {hasAdSetComparisonSelection ? (
                <PdfComparisonSection
                  entityType="ADSET"
                  comparison={adSetComparisonPayload}
                  selectedIds={selectedCompareAdSetIds}
                  nameById={adSetNameById}
                  errorMessage={adSetComparisonErrorMessage}
                />
              ) : null}

              {hasAdComparisonSelection ? (
                <PdfComparisonSection
                  entityType="AD"
                  comparison={adComparisonPayload}
                  selectedIds={selectedCompareAdIds}
                  nameById={adNameById}
                  errorMessage={adComparisonErrorMessage}
                />
              ) : null}
            </div>
            <PdfPageFooter pageNumber={2} totalPages={totalPages} generatedAtLabel={generatedAtLabel} />
          </div>
        ) : null}

        <div className="pdf-landscape-page pdf-page-break-after" data-pdf-page={String(metricsPageNumber)}>
          <section data-pdf-block="metrics" className="surface-panel p-5">
            <h2 className="pdf-section-title text-base font-semibold text-viasoft">Cards de métricas</h2>
            <p className="mt-1 text-sm text-slate-600">
              Comparativo do período atual em relação ao período anterior equivalente.
            </p>
            <div className="mt-3 grid gap-3 grid-cols-2 xl:grid-cols-3">
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
          </section>
          <PdfPageFooter
            pageNumber={metricsPageNumber}
            totalPages={totalPages}
            generatedAtLabel={generatedAtLabel}
          />
        </div>

        <div className="pdf-landscape-page pdf-page-break-after gap-2" data-pdf-page={String(trendPageNumber)}>
          <div data-pdf-block="trend">
            <TrendCard
              direction={comparison.trend.direction}
              costPerResult={comparison.current.costPerResult}
              objectiveCategory={payload.campaign.objectiveCategory}
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
              isPdf
            />
          </div>

          <section
            data-pdf-block="daily-performance"
            className="surface-panel relative overflow-hidden border border-viasoft/15 bg-white p-3"
          >
            <h3 className="pdf-section-title flex items-center gap-2 text-base font-semibold text-viasoft">
              <TrendingUp size={17} className="text-viasoft" />
              Performance diária
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Comparativo visual de {comparison.current.primaryMetricLabel.toLowerCase()} e investimento no período atual.
            </p>
            <div className="mt-2">
              <PerformanceChart
                data={completeChartData}
                primaryMetricLabel={comparison.current.primaryMetricLabel}
                isPdf
              />
            </div>
          </section>
          <PdfPageFooter pageNumber={trendPageNumber} totalPages={totalPages} generatedAtLabel={generatedAtLabel} />
        </div>

        <div className="pdf-landscape-page" data-pdf-page={String(insightsPageNumber)}>
          <div className="flex-1">
            <div data-pdf-block="insights">
              <div data-pdf-block="recommendations">
                <InsightsPanel
                  insights={payload.insights}
                  recommendations={payload.recommendations}
                  isPdf
                />
              </div>
            </div>
          </div>
          <PdfPageFooter
            pageNumber={insightsPageNumber}
            totalPages={totalPages}
            generatedAtLabel={generatedAtLabel}
          />
        </div>
      </section>
    </main>
  );
}
