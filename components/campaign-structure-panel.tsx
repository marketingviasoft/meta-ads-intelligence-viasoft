"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, BarChart3, Clock, ImageOff, Layers, Megaphone, Users, Video, X, ZoomIn } from "lucide-react";
import type { AdAnalytics, MetaAd, MetaAdPreview, MetaAdSet, RangeDays } from "@/lib/types";
import { formatCurrency, formatNumber } from "@/utils/numbers";

type CampaignStructurePanelProps = {
  adSets: MetaAdSet[];
  selectedAdSetId: string;
  onSelectAdSet: (adSetId: string) => void;
  ads: MetaAd[];
  rangeDays: RangeDays;
  selectedCompareAdSetIds: string[];
  onToggleCompareAdSet: (adSetId: string) => void;
  selectedCompareAdIds: string[];
  onToggleCompareAd: (adId: string) => void;
  loadingAdSets: boolean;
  loadingAds: boolean;
  errorMessage?: string;
};

type AdPreviewResponse = {
  data?: MetaAdPreview;
  error?: string;
};

type AdAnalyticsResponse = {
  data?: AdAnalytics;
  error?: string;
};

function listCountLabel(count: number, singular: string, plural: string): string {
  if (count === 1) {
    return `1 ${singular}`;
  }

  return `${count} ${plural}`;
}

export function CampaignStructurePanel({
  adSets,
  selectedAdSetId,
  onSelectAdSet,
  ads,
  rangeDays,
  selectedCompareAdSetIds,
  onToggleCompareAdSet,
  selectedCompareAdIds,
  onToggleCompareAd,
  loadingAdSets,
  loadingAds,
  errorMessage
}: CampaignStructurePanelProps) {
  const [selectedPreviewAd, setSelectedPreviewAd] = useState<MetaAd | null>(null);
  const [adPreviewByAdId, setAdPreviewByAdId] = useState<Record<string, MetaAdPreview>>({});
  const [adPreviewLoadingByAdId, setAdPreviewLoadingByAdId] = useState<Record<string, boolean>>({});
  const [adPreviewErrorByAdId, setAdPreviewErrorByAdId] = useState<Record<string, string>>({});
  const [brokenCreativePreviewByAdId, setBrokenCreativePreviewByAdId] = useState<Record<string, boolean>>({});

  const [adAnalyticsByAdId, setAdAnalyticsByAdId] = useState<Record<string, AdAnalytics>>({});
  const [adAnalyticsLoadingByAdId, setAdAnalyticsLoadingByAdId] = useState<Record<string, boolean>>({});

  const loadedAdPreviewIdsRef = useRef<Set<string>>(new Set());
  const loadingAdPreviewIdsRef = useRef<Set<string>>(new Set());
  const loadedAdAnalyticsIdsRef = useRef<Set<string>>(new Set());
  const loadingAdAnalyticsIdsRef = useRef<Set<string>>(new Set());

  const selectedAdSetName = adSets.find((adSet) => adSet.id === selectedAdSetId)?.name ?? "";
  const adSetSelectionLimitReached = selectedCompareAdSetIds.length >= 2;
  const adSelectionLimitReached = selectedCompareAdIds.length >= 2;
  const adSetCompareCount = selectedCompareAdSetIds.length;
  const adCompareCount = selectedCompareAdIds.length;

  useEffect(() => {
    setSelectedPreviewAd(null);
  }, [selectedAdSetId]);

  useEffect(() => {
    // Reset loaded IDs AND actual data when range changes to force refetch and avoid stale UI
    loadedAdAnalyticsIdsRef.current.clear();
    setAdAnalyticsByAdId({});
  }, [rangeDays]);

  const loadAdPreview = useCallback(async (adId: string): Promise<void> => {
    if (!adId) {
      return;
    }

    if (loadedAdPreviewIdsRef.current.has(adId) || loadingAdPreviewIdsRef.current.has(adId)) {
      return;
    }

    loadingAdPreviewIdsRef.current.add(adId);
    setAdPreviewLoadingByAdId((previous) => ({
      ...previous,
      [adId]: true
    }));

    try {
      const response = await fetch(`/api/meta/ad-preview?adId=${encodeURIComponent(adId)}`, {
        cache: "no-store"
      });

      const payload = (await response.json().catch(() => null)) as AdPreviewResponse | null;
      if (!response.ok) {
        throw new Error(payload?.error || `Erro ao buscar preview (${response.status})`);
      }

      const preview = payload?.data;
      if (!preview?.iframeUrl) {
        throw new Error("Preview avançado indisponível para este anúncio.");
      }

      setAdPreviewByAdId((previous) => ({
        ...previous,
        [adId]: preview
      }));
      loadedAdPreviewIdsRef.current.add(adId);
      setAdPreviewErrorByAdId((previous) => {
        const next = { ...previous };
        delete next[adId];
        return next;
      });
    } catch (error) {
      setAdPreviewErrorByAdId((previous) => ({
        ...previous,
        [adId]:
          error instanceof Error ? error.message : "Não foi possível carregar o preview avançado."
      }));
    } finally {
      loadingAdPreviewIdsRef.current.delete(adId);
      setAdPreviewLoadingByAdId((previous) => ({
        ...previous,
        [adId]: false
      }));
    }
  }, []);

  const loadAdAnalytics = useCallback(async (adId: string, campaignId: string): Promise<void> => {
    if (!adId || !campaignId) return;
    if (loadedAdAnalyticsIdsRef.current.has(adId) || loadingAdAnalyticsIdsRef.current.has(adId)) return;

    loadingAdAnalyticsIdsRef.current.add(adId);
    setAdAnalyticsLoadingByAdId((prev) => ({ ...prev, [adId]: true }));

    try {
      const response = await fetch(
        `/api/meta/ad-analytics?adId=${encodeURIComponent(adId)}&campaignId=${encodeURIComponent(campaignId)}&rangeDays=${rangeDays}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as AdAnalyticsResponse;
      if (payload.data) {
        setAdAnalyticsByAdId((prev) => ({ ...prev, [adId]: payload.data! }));
        loadedAdAnalyticsIdsRef.current.add(adId);
      }
    } catch (error) {
      console.error("Erro ao carregar analytics do anúncio:", error);
    } finally {
      loadingAdAnalyticsIdsRef.current.delete(adId);
      setAdAnalyticsLoadingByAdId((prev) => ({ ...prev, [adId]: false }));
    }
  }, [rangeDays]);

  function openPreviewModal(ad: MetaAd): void {
    setSelectedPreviewAd(ad);
    void loadAdPreview(ad.id);
    void loadAdAnalytics(ad.id, ad.campaignId);
  }

  const closePreviewModal = useCallback((): void => {
    setSelectedPreviewAd(null);
  }, []);

  useEffect(() => {
    if (!selectedPreviewAd) {
      return;
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        closePreviewModal();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closePreviewModal, selectedPreviewAd]);

  useEffect(() => {
    if (!selectedPreviewAd) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedPreviewAd]);

  const activePreview = selectedPreviewAd ? adPreviewByAdId[selectedPreviewAd.id] : undefined;
  const activePreviewLoading = selectedPreviewAd ? adPreviewLoadingByAdId[selectedPreviewAd.id] : false;
  const activePreviewError = selectedPreviewAd ? adPreviewErrorByAdId[selectedPreviewAd.id] : "";

  const markCreativePreviewAsBroken = useCallback((adId: string): void => {
    setBrokenCreativePreviewByAdId((previous) => {
      if (previous[adId]) {
        return previous;
      }

      return {
        ...previous,
        [adId]: true
      };
    });
  }, []);

  return (
    <section data-dashboard-block="campaign-structure" className="surface-panel p-4 sm:p-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-viasoft">
            <Layers size={17} className="text-viasoft" />
            Estrutura da campanha
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Navegue pelos grupos de anúncios e pelos anúncios dentro de cada grupo.
          </p>
        </div>
      </header>

      {errorMessage ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="min-w-0 text-xs font-semibold uppercase tracking-[0.08em] text-viasoft">
              Grupos de anúncios
            </p>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-viasoft/20 bg-viasoft/5 px-2 py-0.5 text-[11px] font-semibold text-viasoft">
                {adSetCompareCount}/2 em comparação
              </span>
              <span className="shrink-0 whitespace-nowrap text-xs text-slate-500">
                {loadingAdSets ? "Carregando..." : listCountLabel(adSets.length, "grupo", "grupos")}
              </span>
            </div>
          </div>

          {loadingAdSets ? (
            <div className="space-y-2">
              <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : adSets.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-500">
              Nenhum grupo de anúncios encontrado para esta campanha.
            </p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto overflow-x-hidden px-1 pr-1.5 py-1">
              {adSets.map((adSet) => {
                const selected = adSet.id === selectedAdSetId;
                const compareChecked = selectedCompareAdSetIds.includes(adSet.id);
                const compareDisabled = !compareChecked && adSetSelectionLimitReached;

                return (
                  <li
                    key={adSet.id}
                    className={`group relative flex flex-col rounded-xl border transition-all duration-200 ${selected
                      ? "border-viasoft/30 bg-viasoft/[0.04] shadow-sm"
                      : "border-slate-200 bg-white hover:border-viasoft/20 hover:bg-viasoft/[0.02]"
                      } ${compareChecked ? "ring-1 ring-inset ring-viasoft/30" : ""}`}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectAdSet(adSet.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectAdSet(adSet.id);
                        }
                      }}
                      className="flex w-full flex-col p-3 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viasoft/35 rounded-xl"
                    >
                      <div className="flex w-full items-center justify-between gap-3">
                        <div className="max-w-[calc(100%-40px)] flex-1">
                          <p
                            className={`break-words text-sm font-medium leading-5 transition-colors ${selected ? "text-viasoft" : "text-slate-700 group-hover:text-viasoft/80"
                              }`}
                          >
                            {adSet.name}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={compareDisabled}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleCompareAdSet(adSet.id);
                          }}
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-200 ${compareChecked
                            ? "border-viasoft/40 bg-viasoft/20 text-viasoft shadow-sm"
                            : compareDisabled
                              ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 opacity-50"
                              : "border-slate-200 bg-white text-slate-400 hover:border-viasoft/30 hover:bg-viasoft/10 hover:text-viasoft"
                            }`}
                          title={compareChecked ? "Remover da comparação" : "Adicionar à comparação"}
                        >
                          <ArrowLeftRight
                            size={15}
                            className={`transition-transform duration-300 ${compareChecked ? "rotate-180" : ""}`}
                          />
                        </button>
                      </div>

                      {compareChecked && (
                        <>
                          <hr className="my-2.5 w-full border-viasoft/10" />
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-viasoft">
                            <span className="h-1.5 w-1.5 rounded-full bg-viasoft animate-pulse" />
                            Em comparação
                          </div>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-viasoft">
              <Megaphone size={14} />
              Anúncios
            </p>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
                {adCompareCount}/2 em comparação
              </span>
              <span className="shrink-0 whitespace-nowrap text-xs text-slate-500">
                {loadingAds ? "Carregando..." : listCountLabel(ads.length, "anúncio", "anúncios")}
              </span>
            </div>
          </div>

          {!selectedAdSetId ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-500">
              Selecione um grupo de anúncios para visualizar os anúncios.
            </p>
          ) : loadingAds ? (
            <div className="space-y-2">
              <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : ads.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-500">
              Nenhum anúncio encontrado no grupo selecionado.
            </p>
          ) : (
            <div>
              <p className="mb-2 break-words text-xs text-slate-500">
                Grupo selecionado: {selectedAdSetName}
              </p>
              <ul className="max-h-72 space-y-3 overflow-y-auto overflow-x-hidden px-1 pr-1.5 py-1">
                {ads.map((ad) => {
                  const compareChecked = selectedCompareAdIds.includes(ad.id);
                  const compareDisabled = !compareChecked && adSelectionLimitReached;
                  const showCreativePreview = Boolean(
                    ad.creativePreviewUrl && !brokenCreativePreviewByAdId[ad.id]
                  );

                  return (
                    <li
                      key={ad.id}
                      className={`relative flex flex-col rounded-xl border p-3 transition-all duration-200 ${compareChecked
                        ? "border-teal-300 bg-teal-50/[0.4] ring-1 ring-inset ring-teal-200/50"
                        : "border-slate-200 bg-slate-50/30 hover:border-teal-200 hover:bg-white"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openPreviewModal(ad)}
                          className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-transform active:scale-95"
                          aria-label={`Abrir preview avançado do anúncio ${ad.name}`}
                          title="Abrir preview avançado"
                        >
                          {showCreativePreview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={ad.creativePreviewUrl}
                              alt={`Criativo do anúncio ${ad.name}`}
                              className="h-full w-full object-cover transition-transform group-hover:scale-110"
                              loading="lazy"
                              onError={() => markCreativePreviewAsBroken(ad.id)}
                            />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-slate-50 px-2 text-center text-[10px] font-medium text-slate-400">
                              <ImageOff size={18} className="text-slate-300" />
                              <span>Sem miniatura</span>
                            </div>
                          )}
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 bg-black/10 opacity-0 transition-opacity group-hover:opacity-100"
                          />
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-white opacity-0 transition-opacity group-hover:opacity-100">
                            <ZoomIn size={18} />
                          </span>
                        </button>

                        <div className="min-w-0 flex-1 max-w-[calc(100%-100px)]">
                          <p className="break-words text-sm font-semibold leading-5 text-slate-800">
                            {ad.name}
                          </p>

                          <p className="mt-1 break-words text-[11px] text-slate-500 line-clamp-1">
                            Criativo: {ad.creativeName}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={compareDisabled}
                          onClick={() => onToggleCompareAd(ad.id)}
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-200 ${compareChecked
                            ? "border-teal-400 bg-teal-100 text-teal-700 shadow-sm"
                            : compareDisabled
                              ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 opacity-50"
                              : "border-slate-200 bg-white text-slate-400 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-600"
                            }`}
                          title={compareChecked ? "Remover da comparação" : "Adicionar à comparação"}
                        >
                          <ArrowLeftRight
                            size={15}
                            className={`transition-transform duration-300 ${compareChecked ? "rotate-180" : ""}`}
                          />
                        </button>
                      </div>

                      {compareChecked && (
                        <>
                          <hr className="my-2.5 w-full border-teal-200/40" />
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-teal-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-teal-600 animate-pulse" />
                            Em comparação
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {selectedPreviewAd ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-sm"
          onClick={closePreviewModal}
        >
          <div
            className="flex h-[92vh] w-[95vw] max-w-[1400px] flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl animate-in fade-in zoom-in duration-200"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-white px-6 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-viasoft/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-viasoft">
                    Preview do Anúncio
                  </span>
                  <p className="truncate text-lg font-bold text-slate-900">{selectedPreviewAd.name}</p>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <Megaphone size={12} className="text-slate-400" /> 
                    <span className="font-medium text-slate-400">Criativo: </span> 
                    <span className="font-semibold text-slate-700">{selectedPreviewAd.creativeName}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={closePreviewModal}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body (Two-Column) */}
            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
              {/* Left Column: Preview */}
              <div className="relative flex-1 overflow-auto border-r border-slate-100 bg-[#f5f5f5]">
                <div className="flex min-h-full w-full items-start justify-center p-4 sm:p-6 lg:p-10">
                  <div className="w-full max-w-[540px] flex-shrink-0">
                    {activePreview?.iframeUrl ? (
                      <div className="flex justify-center rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                        <iframe
                          src={activePreview.iframeUrl}
                          title="Meta Ad Preview"
                          className="w-full border-0"
                          style={{ height: "850px", minHeight: "600px" }}
                        />
                      </div>
                    ) : activePreviewLoading ? (
                      <div className="mx-auto flex w-full max-w-[400px] flex-col gap-4 rounded-xl border border-slate-100 bg-white p-8 shadow-sm">
                        <div className="h-6 w-1/3 animate-pulse rounded bg-slate-100" />
                        <div className="h-40 animate-pulse rounded bg-slate-100" />
                        <div className="h-60 animate-pulse rounded bg-slate-100" />
                        <p className="text-center text-xs text-slate-400">Carregando visualização interativa...</p>
                      </div>
                    ) : (
                      <div className="flex justify-center rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                        {selectedPreviewAd.creativePreviewUrl && !brokenCreativePreviewByAdId[selectedPreviewAd.id] ? (
                          <img
                            src={selectedPreviewAd.creativePreviewUrl}
                            alt="Ad Preview"
                            className="h-auto w-full rounded-lg object-contain"
                            onError={() => markCreativePreviewAsBroken(selectedPreviewAd.id)}
                          />
                        ) : (
                          <div className="flex min-h-[320px] w-full flex-col items-center justify-center gap-2 rounded-lg bg-slate-50 px-6 text-center text-sm text-slate-500">
                            <ImageOff size={28} className="text-slate-300" />
                            <p className="font-medium text-slate-600">Miniatura indisponível</p>
                            <p className="max-w-sm text-xs text-slate-400">
                              Este anúncio não retornou uma imagem válida para visualização estática.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Analytics */}
              <div className="flex w-full flex-col overflow-y-auto bg-white lg:w-[420px] xl:w-[480px]">
                <div className="p-6">
                  <header className="mb-6 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-400">
                      <BarChart3 size={16} /> Performance Estimada
                    </h3>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                      Últimos {rangeDays} dias
                    </span>
                  </header>

                  {adAnalyticsLoadingByAdId[selectedPreviewAd.id] ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-3">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-50" />
                        ))}
                      </div>
                      <div className="h-40 animate-pulse rounded-xl bg-slate-50" />
                      <div className="h-40 animate-pulse rounded-xl bg-slate-50" />
                    </div>
                  ) : adAnalyticsByAdId[selectedPreviewAd.id] ? (
                    <div className="space-y-8">
                      {/* Main Metrics Grid */}
                      <div className={`grid gap-4 grid-cols-2`}>
                        <MetricCard
                          label="Investimento"
                          value={formatCurrency(adAnalyticsByAdId[selectedPreviewAd.id].general.spend)}
                        />
                        <MetricCard
                          label="Resultados"
                          value={formatNumber(adAnalyticsByAdId[selectedPreviewAd.id].general.results)}
                          subValue={adAnalyticsByAdId[selectedPreviewAd.id].general.costPerResult ? `${formatCurrency(adAnalyticsByAdId[selectedPreviewAd.id].general.costPerResult!)}/res` : undefined}
                        />
                        <MetricCard
                          label="Impressões"
                          value={formatNumber(adAnalyticsByAdId[selectedPreviewAd.id].general.impressions)}
                        />
                        <MetricCard
                          label="CTR"
                          value={`${adAnalyticsByAdId[selectedPreviewAd.id].general.ctr.toFixed(2)}%`}
                          subValue={`CPC: ${formatCurrency(adAnalyticsByAdId[selectedPreviewAd.id].general.cpc)}`}
                        />
                      </div>

                      {/* Video Retain (if exists) */}
                      {adAnalyticsByAdId[selectedPreviewAd.id].video && (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-5">
                          <h4 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                            <Video size={14} /> Retenção de Vídeo
                          </h4>
                          <div className="space-y-4">
                            <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-3">
                              <span className="text-xs font-bold text-slate-500">Reproduções do vídeo</span>
                              <span className="text-sm font-bold text-slate-900">
                                {formatNumber(adAnalyticsByAdId[selectedPreviewAd.id].video!.plays)}
                              </span>
                            </div>
                            <RetentionRow
                              label="Taxa de visualizações parciais (3s)"
                              percent={adAnalyticsByAdId[selectedPreviewAd.id].video!.partialViewRate}
                              color="bg-blue-400"
                            />
                            <RetentionRow
                              label="Taxa de visualizações completas"
                              percent={adAnalyticsByAdId[selectedPreviewAd.id].video!.fullViewRate}
                              color="bg-viasoft"
                            />
                            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                              <span className="text-xs text-slate-500">Tempo médio de reprodução</span>
                              <span className="flex items-center gap-1 font-mono text-xs font-bold text-slate-700">
                                <Clock size={12} /> {adAnalyticsByAdId[selectedPreviewAd.id].video!.avgPlayTime.toFixed(1)}s
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Demographics */}
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <h4 className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                            <Users size={14} /> Distribuição por Idade
                          </h4>
                          <div className="space-y-2">
                            {adAnalyticsByAdId[selectedPreviewAd.id].demographics.age.slice(0, 4).map((item) => (
                              <DemographicRow key={item.label} label={item.label} percent={item.percent} color="bg-teal-500" />
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                            Gênero
                          </h4>
                          <div className="space-y-2">
                            {adAnalyticsByAdId[selectedPreviewAd.id].demographics.gender.map((item) => (
                              <DemographicRow key={item.label} label={item.label === "male" ? "Masculino" : item.label === "female" ? "Feminino" : "Outros"} percent={item.percent} color="bg-purple-500" />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 text-slate-400">
                      <BarChart3 size={32} className="mb-2 opacity-20" />
                      <p className="text-xs">Métricas não disponíveis para o período.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MetricCard({
  label,
  value,
  subValue,
  icon
}: {
  label: string;
  value: string;
  subValue?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {subValue && <p className="mt-0.5 text-xs font-medium text-slate-500">{subValue}</p>}
    </div>
  );
}

function RetentionRow({ label, percent, color }: { label: string; percent: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-medium">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-900">{percent.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/60">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function DemographicRow({ label, percent, color }: { label: string; percent: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 text-xs font-bold text-slate-500">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${color} opacity-80`} style={{ width: `${percent}%` }} />
      </div>
      <span className="w-10 text-right text-xs font-bold text-slate-700">{percent.toFixed(0)}%</span>
    </div>
  );
}
