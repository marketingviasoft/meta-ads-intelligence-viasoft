"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, BarChart, Loader2, Sparkles, AlertCircle, RefreshCw } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { ExecutivePerformanceChart } from "@/components/executive-performance-chart";
import { VerticalSelector } from "@/components/vertical-selector";
import { OptionSelector } from "@/components/option-selector";
import { PeriodSelector } from "@/components/period-selector";
import { PUBLICATION_NAME } from "@/lib/branding";
import { buildDashboardHref, type CampaignStatusFilterValue, ALL_VERTICALS_VALUE, CAMPAIGN_STATUS_FILTER_ALL, DELIVERY_STATUS_FILTERS } from "@/lib/dashboard-query";
import { SUPPORTED_VERTICALS } from "@/lib/verticals";
import type { RangeDays, ExecutivePayload, DashboardCampaignSummary } from "@/lib/types";

type ExecutiveDashboardClientProps = {
  initialVerticalTag: string | null;
  initialDeliveryGroup: CampaignStatusFilterValue;
  initialRangeDays: RangeDays;
};

// Formatação Local Utilities
const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const formatNumber = (value: number) => new Intl.NumberFormat("pt-BR").format(value);
const formatPercent = (value: number | null) => value === null ? "-" : new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 1 }).format(value / 100);

export function ExecutiveDashboardClient({
  initialVerticalTag,
  initialDeliveryGroup,
  initialRangeDays
}: ExecutiveDashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [verticalTag, setVerticalTag] = useState<string>(initialVerticalTag ?? ALL_VERTICALS_VALUE);
  const [deliveryGroup, setDeliveryGroup] = useState<CampaignStatusFilterValue>(initialDeliveryGroup);
  const [rangeDays, setRangeDays] = useState<RangeDays>(initialRangeDays);

  const [payload, setPayload] = useState<ExecutivePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);

  const updateUrl = useCallback((newVertical: string, newDelivery: string, newRange: number) => {
    const params = new URLSearchParams(searchParams.toString());

    if (newVertical && newVertical !== ALL_VERTICALS_VALUE) {
      params.set("verticalTag", newVertical);
    } else {
      params.delete("verticalTag");
    }

    if (newDelivery !== CAMPAIGN_STATUS_FILTER_ALL) {
      params.set("deliveryGroup", newDelivery);
    } else {
      params.delete("deliveryGroup");
    }

    params.set("rangeDays", String(newRange));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const handleVerticalChange = (val: string) => {
    setVerticalTag(val);
    updateUrl(val, deliveryGroup, rangeDays);
  };

  const handleDeliveryChange = (val: string) => {
    const nextVal = val as CampaignStatusFilterValue;
    setDeliveryGroup(nextVal);
    updateUrl(verticalTag, nextVal, rangeDays);
  };

  const handleRangeChange = (val: RangeDays) => {
    setRangeDays(val);
    updateUrl(verticalTag, deliveryGroup, val);
  };

  const loadData = useCallback(async (refresh = false) => {
    try {
      const isRefreshing = refresh || !loading;
      if (!isRefreshing) setLoading(true);
      if (refresh) setRefreshing(true);

      const params = new URLSearchParams({
        verticalTag: verticalTag === ALL_VERTICALS_VALUE ? "" : verticalTag,
        deliveryGroup: deliveryGroup,
        rangeDays: String(rangeDays),
      });
      if (refresh) params.set("refresh", "1");

      const response = await fetch(`/api/meta/executive?${params.toString()}`, { cache: "no-store" });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Erro ao carregar os dados consolidados.");
      }

      setPayload(json.data);
      setError("");
    } catch (err: any) {
      setError(err.message || "Erro de conexão ao buscar resumo executivo.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [verticalTag, deliveryGroup, rangeDays]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading && !payload) {
    return (
      <main className="mx-auto w-full max-w-[1280px] p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center text-viasoft">
          <Loader2 className="animate-spin" size={40} />
          <p className="mt-4 font-medium text-sm">Estruturando leitura gerencial consolidada...</p>
        </div>
      </main>
    );
  }

  if (error && !payload) {
    return (
      <main className="mx-auto w-full max-w-[1280px] p-6 lg:p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 flex items-start gap-4 text-red-700">
          <AlertCircle size={24} className="mt-0.5" />
          <div>
            <h3 className="font-semibold text-lg">Houve um problema ao processar o portfólio.</h3>
            <p className="mt-2 text-sm max-w-2xl">{error}</p>
            <button onClick={() => void loadData(true)} className="mt-4 px-4 py-2 bg-red-100 font-semibold rounded-lg hover:bg-red-200 transition">
              Tentar Novamente
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1280px] overflow-x-clip px-5 py-6 sm:px-6 lg:px-8 space-y-6">

      {/* 1. Header Executivo */}
      <header className="surface-panel enter-fade p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-viasoft/20 bg-viasoft/5 px-2.5 py-1.5 text-viasoft">
              <span className="inline-flex size-6 items-center justify-center rounded-lg bg-viasoft text-white">
                <BrandMark variant="icon" size={13} />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                {PUBLICATION_NAME}
              </span>
            </div>
            <h1 className="mt-1 text-3xl font-semibold text-viasoft">Panorama Gerencial da Carteira</h1>
            <p className="mt-2 text-sm text-slate-600 max-w-2xl">
              {payload?.campaigns.length} campanhas selecionadas neste escopo global. Os resultados são apresentados com base nos objetivos de cada campanha de modo isolado.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              disabled={refreshing || loading}
              onClick={() => void loadData(true)}
              className="hover-lift flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Filtros Internos */}
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100 mt-2">
          <div className="w-full sm:w-auto sm:min-w-[200px]">
            <VerticalSelector
              verticals={[...SUPPORTED_VERTICALS]}
              value={verticalTag}
              onChange={handleVerticalChange}
              allOptionValue={ALL_VERTICALS_VALUE}
              disabled={loading || refreshing}
            />
          </div>
          <div className="w-full sm:w-auto sm:min-w-[180px]">
            <OptionSelector
              label="Veiculação"
              options={DELIVERY_STATUS_FILTERS}
              value={deliveryGroup}
              onChange={handleDeliveryChange}
              disabled={loading || refreshing}
            />
          </div>
          <div className="w-full sm:w-auto sm:min-w-[160px]">
            <PeriodSelector
              value={rangeDays}
              onChange={handleRangeChange}
              disabled={loading || refreshing}
            />
          </div>
        </div>
      </header>

      {/* 3. Cards KPI Consolidados */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 enter-fade" style={{ animationDelay: '50ms' }}>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between min-h-[110px]">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Investimento Total</span>
          <div className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(payload?.globalMetrics.spend || 0)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between min-h-[110px]">
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ações no Objetivo</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900">{formatNumber(payload?.globalMetrics.results || 0)}</span>
            <p className="text-[10px] font-medium text-slate-400 mt-1 leading-tight">Soma multi-objetivo</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between min-h-[110px]">
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Custo per Ação (Méd)</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900">{payload?.globalMetrics.costPerResult ? formatCurrency(payload.globalMetrics.costPerResult) : '-'}</span>
            <p className="text-[10px] font-medium text-slate-400 mt-1 leading-tight">Média do portfólio</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between min-h-[110px]">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Impressões Entregues</span>
          <div className="mt-2 text-2xl font-bold text-slate-900">{formatNumber(payload?.globalMetrics.impressions || 0)}</div>
        </div>
      </section>

      {/* 6. Distribuições de Verba e 5. Rankings */}
      <section className="grid md:grid-cols-12 gap-6 enter-fade" style={{ animationDelay: '100ms' }}>
        <article className="surface-panel p-6 md:col-span-8">
          <h3 className="text-base font-semibold text-viasoft flex items-center gap-2 mb-6">
            <BarChart size={18} /> Alocações do Portfólio
          </h3>
          <div className="grid sm:grid-cols-3 gap-6">

            {/* Por Objetivo */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">Por Objetivo</h4>
              <div className="space-y-4">
                {payload?.objectiveDistribution.map((dist) => (
                  <div key={dist.objectiveCategory}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium text-slate-800 truncate pr-2">{dist.objectiveCategory}</span>
                      <span className="text-slate-600 font-semibold">{formatCurrency(dist.spend)}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-viasoft rounded-full" style={{ width: `${dist.percent}%` }} />
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                      <span>{formatPercent(dist.percent)} verba</span>
                      <span>{dist.resultsPercent !== null ? `${formatPercent(dist.resultsPercent)} res.` : `${formatNumber(dist.results)} res.`}</span>
                    </div>
                  </div>
                ))}
                {payload?.objectiveDistribution.length === 0 && (
                  <p className="text-xs text-slate-500">Sem dados.</p>
                )}
              </div>
            </div>

            {/* Por Status */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">Por Status</h4>
              <div className="space-y-4">
                {payload?.statusDistribution.map((dist) => (
                  <div key={dist.deliveryGroup}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium text-slate-800 truncate pr-2">{dist.deliveryGroup}</span>
                      <span className="text-slate-600 font-semibold">{formatCurrency(dist.spend)}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${dist.percent}%` }} />
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                      <span>{formatPercent(dist.percent)} verba</span>
                      <span>{dist.resultsPercent !== null ? `${formatPercent(dist.resultsPercent)} res.` : `${formatNumber(dist.results)} res.`}</span>
                    </div>
                  </div>
                ))}
                {payload?.statusDistribution.length === 0 && (
                  <p className="text-xs text-slate-500">Sem dados.</p>
                )}
              </div>
            </div>

            {/* Por Vertical */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">Por Vertical</h4>
              <div className="space-y-4">
                {payload?.verticalDistribution.map((dist) => (
                  <div key={dist.verticalTag}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium text-slate-800 truncate pr-2">{dist.verticalTag || "sem-vertical"}</span>
                      <span className="text-slate-600 font-semibold">{formatCurrency(dist.spend)}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${dist.percent}%` }} />
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                      <span>{formatPercent(dist.percent)} verba</span>
                      <span>{dist.resultsPercent !== null ? `${formatPercent(dist.resultsPercent)} res.` : `${formatNumber(dist.results)} res.`}</span>
                    </div>
                  </div>
                ))}
                {payload?.verticalDistribution.length === 0 && (
                  <p className="text-xs text-slate-500">Sem dados.</p>
                )}
              </div>
            </div>

          </div>
        </article>

        <article className="surface-panel p-6 md:col-span-4">
          <h3 className="text-base font-semibold text-viasoft flex items-center gap-2 mb-6">
            <Sparkles size={18} /> Top 3 Eficiências
          </h3>
          <p className="text-xs text-slate-500 mb-4 -mt-3">Campanhas com o menor custo por resultado válido.</p>
          <div className="space-y-3">
            {[...(payload?.campaigns || [])]
              .filter(c => c.metrics.results > 0 && c.metrics.costPerResult !== null)
              .sort((a, b) => (a.metrics.costPerResult || Infinity) - (b.metrics.costPerResult || Infinity))
              .slice(0, 3)
              .map((camp, idx) => (
                <div key={camp.campaign.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50 transition hover:bg-slate-50">
                  <div className="flex items-center gap-3 w-full sm:w-auto overflow-hidden">
                    <div className="flex-shrink-0 size-8 rounded-full bg-viasoft text-white flex items-center justify-center font-bold text-xs">
                      #{idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{camp.campaign.name}</p>
                      <p className="text-xs text-slate-500">{camp.campaign.objectiveCategory}</p>
                    </div>
                  </div>
                  <div className="text-right sm:min-w-[120px]">
                    <p className="text-sm font-bold text-viasoft">{formatCurrency(camp.metrics.costPerResult!)}</p>
                    <p className="text-xs text-slate-500">{formatNumber(camp.metrics.results)} resultados</p>
                  </div>
                </div>
              ))}
            {(!payload?.campaigns || payload.campaigns.filter(c => c.metrics.results > 0).length === 0) && (
              <p className="text-sm text-slate-500">Métricas de eficiência não consolidadas para as campanhas filtradas.</p>
            )}
          </div>
        </article>
      </section>

      {/* 4. Gráfico Temporal Consolidado */}
      {payload?.chart && payload.chart.length > 0 && (
        <section className="surface-panel p-6 enter-fade" style={{ animationDelay: '120ms' }}>
          <h3 className="text-base font-semibold text-viasoft mb-6">Evolução Consolidada</h3>
          <ExecutivePerformanceChart data={payload.chart} />
        </section>
      )}

      {/* 8. Insights Gerenciais */}
      {payload?.insights && payload.insights.length > 0 && (
        <section className="surface-panel p-6 enter-fade" style={{ animationDelay: '130ms' }}>
          <h3 className="text-base font-semibold text-viasoft mb-4">Insights de Carteira</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {payload.insights.map((insight, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                <p className="text-sm font-semibold text-slate-900">{insight.title}</p>
                <p className="mt-1 text-xs text-slate-600">{insight.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 7. Tabela Dashboard Analítico Links */}
      <section className="surface-panel p-6 enter-fade" style={{ animationDelay: '150ms' }}>
        <h3 className="text-base font-semibold text-viasoft mb-6">Listagem e Detalhamento</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-medium">
                <th className="pb-3 px-2">Campanha</th>
                <th className="pb-3 px-2">Objetivo</th>
                <th className="pb-3 px-2 text-right">Investimento</th>
                <th className="pb-3 px-2 text-right">Ações (Res.)</th>
                <th className="pb-3 px-2 text-right">Custo / Ação</th>
                <th className="pb-3 px-2 w-[100px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payload?.campaigns.map((row) => (
                <tr key={row.campaign.id} className="hover:bg-slate-50/75 transition-colors group">
                  <td className="py-3 px-2 cursor-default flex flex-col gap-0.5 max-w-[280px]">
                    <span className="font-semibold text-slate-800 truncate" title={row.campaign.name}>{row.campaign.name}</span>
                    <span className="text-xs text-slate-400">ID: {row.campaign.id}</span>
                  </td>
                  <td className="py-3 px-2">
                    <span className="inline-flex px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                      {row.campaign.objectiveCategory}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right font-medium text-slate-900">{formatCurrency(row.metrics.spend)}</td>
                  <td className="py-3 px-2 text-right text-slate-700">{formatNumber(row.metrics.results)}</td>
                  <td className="py-3 px-2 text-right text-slate-700">{row.metrics.costPerResult ? formatCurrency(row.metrics.costPerResult) : '-'}</td>
                  <td className="py-3 px-2 text-right">
                    <Link
                      href={buildDashboardHref({
                        pathname: "/dashboard/campanhas",
                        verticalTag: verticalTag === ALL_VERTICALS_VALUE ? null : verticalTag,
                        deliveryGroup: deliveryGroup,
                        rangeDays: rangeDays,
                        campaignId: row.campaign.id
                      })}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-viasoft opacity-0 group-hover:opacity-100 transition focus:opacity-100 px-3 py-1.5 rounded-lg hover:bg-viasoft/10"
                    >
                      Analítico <ArrowRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
              {payload?.campaigns.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">Nenhuma campanha neste escopo temporal.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

    </main>
  );
}
