"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleAlert, FileDown, Loader2, RefreshCw } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { CampaignStructurePanel } from "@/components/campaign-structure-panel";
import { CampaignSelector } from "@/components/campaign-selector";
import { CampaignHeaderCard, DashboardReport, VerticalBudgetSummaryPanel } from "@/components/dashboard-report";
import { PeriodSelector } from "@/components/period-selector";
import { VerticalSelector } from "@/components/vertical-selector";
import { PUBLICATION_NAME } from "@/lib/branding";
import type {
  DashboardPayload,
  MetaAd,
  MetaAdSet,
  MetaCampaign,
  RangeDays,
  VerticalBudgetSummary
} from "@/lib/types";
import { resolveSupportedVertical, SUPPORTED_VERTICALS } from "@/lib/verticals";

type CampaignsResponse = {
  data?: MetaCampaign[];
  error?: string;
};

type PerformanceResponse = {
  data?: DashboardPayload;
  error?: string;
};

type AdSetsResponse = {
  data?: MetaAdSet[];
  error?: string;
};

type AdsResponse = {
  data?: MetaAd[];
  error?: string;
};

type VerticalBudgetResponse = {
  data?: VerticalBudgetSummary;
  error?: string;
};

const CACHE_TTL_MS = 5 * 60 * 1000;

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    cache: "no-store"
  });

  const contentType = response.headers.get("content-type") ?? "";
  let body: unknown = null;

  if (contentType.includes("application/json")) {
    body = await response.json().catch(() => null);
  } else {
    const text = await response.text().catch(() => "");
    body = text ? text.slice(0, 600) : null;
  }

  if (!response.ok) {
    const msg =
      body && typeof body === "object" && body !== null
        ? "error" in body && (body as { error?: unknown }).error
          ? String((body as { error?: unknown }).error)
          : JSON.stringify(body)
        : typeof body === "string"
          ? body
          : "";
    throw new Error(msg || `Falha HTTP Meta API: ${response.status}`);
  }

  return body as T;
}

export function DashboardClient() {
  const campaignRefreshRequestedRef = useRef<string | null>(null);
  const adSetRefreshRequestedRef = useRef<boolean>(false);
  const previousCampaignIdRef = useRef<string>("");

  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [selectedVertical, setSelectedVertical] = useState<string>(SUPPORTED_VERTICALS[0]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [adSets, setAdSets] = useState<MetaAdSet[]>([]);
  const [selectedAdSetId, setSelectedAdSetId] = useState<string>("");
  const [ads, setAds] = useState<MetaAd[]>([]);
  const [verticalBudget, setVerticalBudget] = useState<VerticalBudgetSummary | null>(null);
  const [rangeDays, setRangeDays] = useState<RangeDays>(7);
  const [reportData, setReportData] = useState<DashboardPayload | null>(null);
  const [loadingCampaigns, setLoadingCampaigns] = useState<boolean>(true);
  const [loadingAdSets, setLoadingAdSets] = useState<boolean>(false);
  const [loadingAds, setLoadingAds] = useState<boolean>(false);
  const [loadingVerticalBudget, setLoadingVerticalBudget] = useState<boolean>(false);
  const [loadingPerformance, setLoadingPerformance] = useState<boolean>(false);
  const [manualRefreshing, setManualRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [structureErrorMessage, setStructureErrorMessage] = useState<string>("");
  const [verticalBudgetErrorMessage, setVerticalBudgetErrorMessage] = useState<string>("");

  const verticalOptions = useMemo(() => [...SUPPORTED_VERTICALS], []);

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(
      (campaign) => resolveSupportedVertical(campaign.verticalTag) === selectedVertical
    );
  }, [campaigns, selectedVertical]);

  const hasFilteredCampaigns = filteredCampaigns.length > 0;
  const noCampaignsForSelectedVertical = !loadingCampaigns && !hasFilteredCampaigns;

  const loadCampaigns = useCallback(async (refresh = false): Promise<void> => {
    setLoadingCampaigns(true);

    try {
      const response = await requestJson<CampaignsResponse>(
        `/api/meta/campaigns${refresh ? "?refresh=1" : ""}`
      );
      const nextCampaigns = response.data ?? [];

      setCampaigns(nextCampaigns);
      setSelectedCampaignId((previous) => {
        if (previous && nextCampaigns.some((campaign) => campaign.id === previous)) {
          return previous;
        }

        return nextCampaigns[0]?.id ?? "";
      });

      if (nextCampaigns.length === 0) {
        setReportData(null);
      }

      setErrorMessage("");
    } catch (error) {
      setReportData(null);
      setErrorMessage(
        `Campaigns: ${error instanceof Error ? error.message : "Erro ao carregar campanhas"}`
      );
    } finally {
      setLoadingCampaigns(false);
    }
  }, []);

  const loadVerticalBudget = useCallback(
    async (verticalTag: string, refresh = false): Promise<void> => {
      if (!verticalTag) {
        setVerticalBudget(null);
        setVerticalBudgetErrorMessage("");
        return;
      }

      setLoadingVerticalBudget(true);

      try {
        const response = await requestJson<VerticalBudgetResponse>(
          `/api/meta/vertical-budget?verticalTag=${encodeURIComponent(verticalTag)}${refresh ? "&refresh=1" : ""}`
        );

        if (!response.data) {
          throw new Error("Resposta de orçamento da vertical vazia");
        }

        setVerticalBudget(response.data);
        setVerticalBudgetErrorMessage("");
      } catch (error) {
        setVerticalBudget(null);
        setVerticalBudgetErrorMessage(
          `Orçamento: ${error instanceof Error ? error.message : "Erro ao carregar investimento da vertical"}`
        );
      } finally {
        setLoadingVerticalBudget(false);
      }
    },
    []
  );

  const loadPerformance = useCallback(
    async (forceRefresh = false): Promise<void> => {
      if (!selectedCampaignId) {
        return;
      }

      setLoadingPerformance(true);

      try {
        const endpoint = `/api/meta/performance?campaignId=${encodeURIComponent(
          selectedCampaignId
        )}&rangeDays=${rangeDays}${forceRefresh ? "&refresh=1" : ""}`;

        const response = await requestJson<PerformanceResponse>(endpoint);

        if (!response.data) {
          throw new Error("Resposta de performance vazia");
        }

        setReportData(response.data);
        setErrorMessage("");
      } catch (error) {
        setReportData(null);
        setErrorMessage(
          `Performance: ${error instanceof Error ? error.message : "Erro ao carregar performance"}`
        );
      } finally {
        setLoadingPerformance(false);
      }
    },
    [rangeDays, selectedCampaignId]
  );

  const loadCampaignAdSets = useCallback(
    async (campaignId: string, refresh = false): Promise<void> => {
      if (!campaignId) {
        setAdSets([]);
        setSelectedAdSetId("");
        setAds([]);
        setStructureErrorMessage("");
        return;
      }

      setLoadingAdSets(true);

      try {
        const response = await requestJson<AdSetsResponse>(
          `/api/meta/adsets?campaignId=${encodeURIComponent(campaignId)}${refresh ? "&refresh=1" : ""}`
        );

        const nextAdSets = response.data ?? [];
        setAdSets(nextAdSets);
        setSelectedAdSetId((previous) => {
          if (previous && nextAdSets.some((adSet) => adSet.id === previous)) {
            return previous;
          }

          return nextAdSets[0]?.id ?? "";
        });
        setStructureErrorMessage("");
      } catch (error) {
        setAdSets([]);
        setSelectedAdSetId("");
        setAds([]);
        setStructureErrorMessage(
          `Estrutura: ${error instanceof Error ? error.message : "Erro ao carregar grupos de anúncios"}`
        );
      } finally {
        setLoadingAdSets(false);
      }
    },
    []
  );

  const loadAdSetAds = useCallback(async (adSetId: string, refresh = false): Promise<void> => {
    if (!adSetId) {
      setAds([]);
      return;
    }

    setLoadingAds(true);

    try {
      const response = await requestJson<AdsResponse>(
        `/api/meta/ads?adSetId=${encodeURIComponent(adSetId)}${refresh ? "&refresh=1" : ""}`
      );

      setAds(response.data ?? []);
      setStructureErrorMessage("");
    } catch (error) {
      setAds([]);
      setStructureErrorMessage(
        `Estrutura: ${error instanceof Error ? error.message : "Erro ao carregar anúncios"}`
      );
    } finally {
      setLoadingAds(false);
    }
  }, []);

  useEffect(() => {
    void loadCampaigns(false);
  }, [loadCampaigns]);

  useEffect(() => {
    void loadVerticalBudget(selectedVertical, false);
  }, [loadVerticalBudget, selectedVertical]);

  useEffect(() => {
    setSelectedCampaignId((previous) => {
      if (previous && filteredCampaigns.some((campaign) => campaign.id === previous)) {
        return previous;
      }

      return filteredCampaigns[0]?.id ?? "";
    });

    if (filteredCampaigns.length === 0) {
      setReportData(null);
      setAdSets([]);
      setSelectedAdSetId("");
      setAds([]);
    }
  }, [filteredCampaigns]);

  useEffect(() => {
    if (filteredCampaigns.length === 0 || !selectedCampaignId) {
      return;
    }

    const campaignChanged = previousCampaignIdRef.current !== selectedCampaignId;
    previousCampaignIdRef.current = selectedCampaignId;

    const shouldForceRefresh = campaignRefreshRequestedRef.current === selectedCampaignId;
    if (shouldForceRefresh) {
      campaignRefreshRequestedRef.current = null;
      adSetRefreshRequestedRef.current = true;
    }

    void loadPerformance(shouldForceRefresh);

    if (campaignChanged || shouldForceRefresh) {
      void loadCampaignAdSets(selectedCampaignId, shouldForceRefresh);
    }
  }, [filteredCampaigns.length, loadCampaignAdSets, loadPerformance, selectedCampaignId]);

  useEffect(() => {
    const shouldForceRefreshAds = adSetRefreshRequestedRef.current;
    if (shouldForceRefreshAds) {
      adSetRefreshRequestedRef.current = false;
    }

    void loadAdSetAds(selectedAdSetId, shouldForceRefreshAds);
  }, [loadAdSetAds, selectedAdSetId]);

  const handleCampaignChange = useCallback((campaignId: string): void => {
    campaignRefreshRequestedRef.current = campaignId;
    setSelectedCampaignId(campaignId);
  }, []);

  const handleManualRefresh = useCallback(async (): Promise<void> => {
    if (manualRefreshing) {
      return;
    }

    setManualRefreshing(true);

    try {
      const campaignIdForRefresh = selectedCampaignId;
      const adSetIdForRefresh = selectedAdSetId;

      await Promise.all([
        loadCampaigns(true),
        loadVerticalBudget(selectedVertical, true)
      ]);

      if (campaignIdForRefresh) {
        await Promise.all([
          loadPerformance(true),
          loadCampaignAdSets(campaignIdForRefresh, true)
        ]);

        if (adSetIdForRefresh) {
          await loadAdSetAds(adSetIdForRefresh, true);
        }
      }
    } catch (error) {
      setErrorMessage(
        `Refresh: ${error instanceof Error ? error.message : "Erro ao atualizar dados"}`
      );
    } finally {
      setManualRefreshing(false);
    }
  }, [
    manualRefreshing,
    loadAdSetAds,
    loadCampaignAdSets,
    loadCampaigns,
    loadPerformance,
    loadVerticalBudget,
    selectedAdSetId,
    selectedCampaignId,
    selectedVertical
  ]);

  const pdfUrl = useMemo(() => {
    if (!selectedCampaignId) {
      return "";
    }

    return `/api/pdf?campaignId=${encodeURIComponent(selectedCampaignId)}&rangeDays=${rangeDays}`;
  }, [rangeDays, selectedCampaignId]);

  const isContingencySnapshot = useMemo(() => {
    if (!reportData?.generatedAt) {
      return false;
    }

    const generatedAtMs = Date.parse(reportData.generatedAt);
    if (Number.isNaN(generatedAtMs)) {
      return false;
    }

    return Date.now() - generatedAtMs > CACHE_TTL_MS;
  }, [reportData]);

  return (
    <main className="mx-auto w-full max-w-[1280px] overflow-x-clip px-5 py-6 sm:px-6 lg:px-8">
      <header className="surface-panel enter-fade p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-viasoft/20 bg-viasoft/5 px-2.5 py-1.5 text-viasoft">
              <span className="inline-flex size-6 items-center justify-center rounded-lg bg-viasoft text-white">
                <BrandMark variant="icon" size={13} />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                {PUBLICATION_NAME}
              </span>
            </div>
            <h1 className="mt-1 text-3xl font-semibold text-viasoft">Performance executiva com dados do Meta</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Períodos de performance excluem o dia atual e comparam automaticamente contra o período anterior equivalente.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                if (pdfUrl) {
                  window.location.assign(pdfUrl);
                }
              }}
              disabled={!selectedCampaignId || loadingPerformance}
              className="hover-lift inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-viasoft/80 bg-viasoft/5 px-4 text-sm font-semibold text-viasoft transition hover:bg-viasoft hover:text-white active:bg-viasoft-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viasoft/25 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
            >
              <FileDown size={16} />
              Gerar PDF
            </button>
            <button
              type="button"
              onClick={() => void handleManualRefresh()}
              disabled={
                manualRefreshing ||
                loadingCampaigns ||
                loadingPerformance ||
                loadingAdSets ||
                loadingAds ||
                loadingVerticalBudget
              }
              className="hover-lift inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-viasoft px-4 text-sm font-semibold text-white shadow-sm shadow-viasoft/25 transition hover:bg-viasoft-700 active:bg-viasoft-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viasoft/25 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <RefreshCw
                size={16}
                className={
                  manualRefreshing || loadingCampaigns || loadingPerformance || loadingVerticalBudget
                    ? "animate-spin"
                    : ""
                }
              />
              Atualizar Dados
            </button>
          </div>
        </div>
      </header>

      <section className="surface-panel mt-5 p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-4 lg:items-end">
          <div className="min-w-0 lg:col-span-1">
            <VerticalSelector
              verticals={verticalOptions}
              value={selectedVertical}
              onChange={setSelectedVertical}
              disabled={loadingCampaigns}
            />
          </div>
          <div className="min-w-0 lg:col-span-2">
            <CampaignSelector
              campaigns={filteredCampaigns}
              value={selectedCampaignId}
              onChange={handleCampaignChange}
              disabled={loadingCampaigns || !hasFilteredCampaigns}
            />
          </div>
          <div className="min-w-0 lg:col-span-1">
            <PeriodSelector
              value={rangeDays}
              onChange={setRangeDays}
              disabled={loadingCampaigns || !hasFilteredCampaigns || !selectedCampaignId}
            />
          </div>
        </div>
        <div className="mt-4 border-t border-slate-200 pt-4">
          {loadingVerticalBudget ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <div className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Carregando investimento da vertical...
              </div>
            </div>
          ) : verticalBudget ? (
            <VerticalBudgetSummaryPanel verticalBudget={verticalBudget} />
          ) : verticalBudgetErrorMessage ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              {verticalBudgetErrorMessage}
            </div>
          ) : null}
        </div>
      </section>

      {errorMessage ? (
        <section className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-800 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="inline-flex items-start gap-2">
              <CircleAlert size={16} className="mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </p>
            <button
              type="button"
              onClick={() => void loadCampaigns(true)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              <Loader2 size={14} />
              Tentar novamente
            </button>
          </div>
        </section>
      ) : null}

      {noCampaignsForSelectedVertical ? (
        <section className="mt-5 surface-panel p-4">
          <div className="flex items-start gap-2.5 text-sm text-slate-700">
            <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <CircleAlert size={15} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-viasoft">
                Campanhas da vertical
              </p>
              <p className="mt-1">Não há nenhuma campanha ativa para a vertical selecionada.</p>
            </div>
          </div>
        </section>
      ) : null}

      {loadingCampaigns || loadingPerformance ? (
        <section className="mt-5 surface-panel p-6 text-sm text-slate-600">
          <div className="inline-flex items-center gap-2">
            <Loader2 size={16} className="animate-spin" />
            Carregando dados...
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
          </div>
        </section>
      ) : null}

      {reportData ? (
        <section className="mt-5 space-y-5">
          {isContingencySnapshot ? (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
              Dados em contingência: a Meta API não respondeu no último refresh e o dashboard está exibindo o snapshot mais recente disponível em cache.
            </section>
          ) : null}

          <CampaignHeaderCard
            campaign={reportData.campaign}
            range={reportData.range}
          />

          <CampaignStructurePanel
            adSets={adSets}
            selectedAdSetId={selectedAdSetId}
            onSelectAdSet={setSelectedAdSetId}
            ads={ads}
            loadingAdSets={loadingAdSets}
            loadingAds={loadingAds}
            errorMessage={structureErrorMessage}
          />
          <DashboardReport data={reportData} hideCampaignHeader />
          <p className="text-right text-xs text-slate-500">
            Atualizado em {new Date(reportData.generatedAt).toLocaleString("pt-BR")}
          </p>
        </section>
      ) : null}
    </main>
  );
}
