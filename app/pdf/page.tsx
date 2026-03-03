import {
  Layers3,
  MousePointerClick,
  Coins,
  Eye,
  Percent,
  TrendingUp,
  Wallet
} from "lucide-react";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { CampaignHeaderCard } from "@/components/dashboard-report";
import { InsightsPanel } from "@/components/insights-panel";
import { MetricCard } from "@/components/metric-card";
import { PerformanceChart } from "@/components/performance-chart";
import { PdfReadyFlag } from "@/components/pdf-ready-flag";
import { TrendCard } from "@/components/trend-card";
import { getActiveCampaigns, getAdSetAds, getCampaignAdSets, getDashboardPayload } from "@/lib/meta-dashboard";
import { PDF_BRAND_SIGNATURE, PDF_TOTAL_PAGES } from "@/pdf/layout-preset";
import type { DailyMetricPoint, DashboardPayload } from "@/lib/types";
import { parseRangeDays } from "@/utils/date-range";
import { formatCurrencyBRL, formatNumberBR, formatPercentBR } from "@/utils/formatters";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
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

function PdfPageFooter({
  pageNumber,
  generatedAtLabel,
  dockBottom = true
}: {
  pageNumber: number;
  generatedAtLabel: string;
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
        Página {pageNumber}/{PDF_TOTAL_PAGES} · Atualizado em {generatedAtLabel}
      </p>
    </footer>
  );
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
  const rangeFromQuery = Array.isArray(params.rangeDays) ? params.rangeDays[0] : params.rangeDays;
  const rangeDays = parseRangeDays(rangeFromQuery);

  const campaigns = await getActiveCampaigns(false);
  const campaignId = campaignFromQuery ?? campaigns[0]?.id;

  if (!campaignId) {
    return (
      <main className="mx-auto mt-6 max-w-3xl rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        Nenhuma campanha ACTIVE foi encontrada para renderizar o PDF.
      </main>
    );
  }

  const payload = await getDashboardPayload({
    campaignId,
    rangeDays
  });
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

  const adSets = await getCampaignAdSets(campaignId, false);
  const selectedAdSetId = adSets[0]?.id ?? "";
  const ads = selectedAdSetId ? await getAdSetAds(selectedAdSetId, false) : [];
  const selectedAdSetName = adSets[0]?.name ?? "";
  const selectedVerticalLabel =
    payload.campaign.verticalTag && payload.campaign.verticalTag !== "Sem vertical"
      ? payload.campaign.verticalTag
      : "Todas as verticais";
  const generatedAtLabel = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(payload.generatedAt));

  return (
    <main className="min-h-screen bg-white py-3 print:py-0">
      <PdfReadyFlag />
      <section className="pdf-shell mx-auto w-full print:max-w-none print:px-0 print:py-0">
        <div className="pdf-landscape-page pdf-page-break-after">
          <header className="surface-panel p-6">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-viasoft/20 bg-viasoft/5 px-2.5 py-1.5 text-viasoft">
              <span className="inline-flex size-6 items-center justify-center rounded-md bg-viasoft text-white">
                <BrandMark variant="icon" size={13} />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                {PDF_BRAND_SIGNATURE}
              </span>
            </div>
            <h1 className="mt-1 text-4xl font-semibold text-viasoft">Performance executiva com dados do Meta</h1>
            <p className="mt-2 text-base text-slate-600">
              Períodos sempre excluem o dia atual e comparam automaticamente contra o período anterior equivalente.
            </p>
          </header>

          <section className="surface-panel p-5">
            <div className="grid gap-4 lg:grid-cols-4 lg:items-end">
              <div className="lg:col-span-1">
                <PdfSelectorField
                  label="Vertical"
                  value={selectedVerticalLabel}
                  icon={<Layers3 size={14} className="text-viasoft" />}
                />
              </div>
              <div className="lg:col-span-2">
                <PdfSelectorField label="Campanhas ativas" value={payload.campaign.name} />
              </div>
              <div className="lg:col-span-1">
                <PdfSelectorField label="Período" value={`Últimos ${payload.range.days} dias`} />
              </div>
            </div>
          </section>

          <CampaignHeaderCard campaign={payload.campaign} range={payload.range} isPdf />

          <section className="surface-panel p-4">
            <h2 className="pdf-section-title text-base font-semibold text-viasoft">Estrutura da campanha</h2>
            <p className="mt-1 text-sm text-slate-600">
              Grupos de anúncios e anúncios ativos no momento da geração do relatório.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-viasoft">
                  Grupos de anúncios
                </p>
                {adSets.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Nenhum grupo ativo encontrado.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {adSets.slice(0, 8).map((adSet) => (
                      <li key={adSet.id} className="rounded-md border border-slate-200 px-2 py-1">
                        {adSet.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-viasoft">
                  Anúncios ({selectedAdSetName || "grupo não selecionado"})
                </p>
                {ads.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Nenhum anúncio ativo encontrado.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {ads.slice(0, 8).map((ad) => (
                      <li key={ad.id} className="rounded-md border border-slate-200 px-2 py-1">
                        {ad.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
          <PdfPageFooter pageNumber={1} generatedAtLabel={generatedAtLabel} />
        </div>

        <div className="pdf-landscape-page pdf-page-break-after">
          <section className="surface-panel p-5">
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
          <PdfPageFooter pageNumber={2} generatedAtLabel={generatedAtLabel} />
        </div>

        <div className="pdf-landscape-page pdf-page-break-after gap-3">
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

          <section className="surface-panel relative overflow-hidden border border-viasoft/15 bg-white p-4">
            <h3 className="pdf-section-title flex items-center gap-2 text-base font-semibold text-viasoft">
              <TrendingUp size={17} className="text-viasoft" />
              Performance diária
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Comparativo visual de {comparison.current.primaryMetricLabel.toLowerCase()} e investimento no período atual.
            </p>
            <div className="mt-3">
              <PerformanceChart
                data={completeChartData}
                primaryMetricLabel={comparison.current.primaryMetricLabel}
                isPdf
              />
            </div>
          </section>
          <PdfPageFooter pageNumber={3} generatedAtLabel={generatedAtLabel} dockBottom={false} />
        </div>

        <div className="pdf-landscape-page">
          <div className="flex-1">
            <InsightsPanel
              insights={payload.insights}
              recommendations={payload.recommendations}
              isPdf
              fillHeight
            />
          </div>
          <PdfPageFooter pageNumber={4} generatedAtLabel={generatedAtLabel} />
        </div>
      </section>
    </main>
  );
}
