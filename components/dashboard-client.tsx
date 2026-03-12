"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { CircleAlert, FileDown, Loader2, RefreshCw } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { CampaignStructurePanel } from "@/components/campaign-structure-panel";
import { CampaignSelector } from "@/components/campaign-selector";
import { CampaignHeaderCard, DashboardReport, VerticalBudgetSummaryPanel } from "@/components/dashboard-report";
import { OptionSelector } from "@/components/option-selector";
import { PeriodSelector } from "@/components/period-selector";
import { StructureComparisonSection } from "@/components/structure-comparison-section";
import { VerticalSelector } from "@/components/vertical-selector";
import { PUBLICATION_NAME } from "@/lib/branding";
import type {
  DashboardPayload,
  MetaAd,
  MetaAdSet,
  MetaCampaign,
  RangeDays,
  StructureComparisonEntityType,
  StructureComparisonPayload,
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

type StructureComparisonResponse = {
  data?: StructureComparisonPayload;
  error?: string;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const CAMPAIGN_STATUS_FILTER_ALL = "ALL" as const;
const ALL_VERTICALS_VALUE = "__ALL_VERTICALS__" as const;
type CampaignStatusFilterValue =
  | typeof CAMPAIGN_STATUS_FILTER_ALL
  | "ACTIVE"
  | "PAUSED"
  | "WITH_ISSUES"
  | "PENDING_REVIEW"
  | "ARCHIVED";

const DELIVERY_STATUS_FILTERS: Array<{
  value: CampaignStatusFilterValue;
  label: string;
}> = [
  { value: CAMPAIGN_STATUS_FILTER_ALL, label: "Todos os status" },
  { value: "ACTIVE", label: "Ativas" },
  { value: "PAUSED", label: "Pausadas" },
  { value: "WITH_ISSUES", label: "Com problemas" },
  { value: "PENDING_REVIEW", label: "Em análise" },
  { value: "ARCHIVED", label: "Arquivadas" }
];

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

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function extractRetryAfterSecondsFromMessage(message: string): number | null {
  const normalized = message.toLowerCase();
  const patterns = [
    /cerca de\s+(\d+)\s*s/i,
    /em\s+(\d+)\s*s/i,
    /(\d+)\s*seg/i
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return null;
}

export function DashboardClient() {
  const campaignRefreshRequestedRef = useRef<string | null>(null);
  const adSetRefreshRequestedRef = useRef<boolean>(false);
  const previousCampaignIdRef = useRef<string>("");

  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [selectedVertical, setSelectedVertical] = useState<string>(ALL_VERTICALS_VALUE);
  const [campaignStatusFilter, setCampaignStatusFilter] =
    useState<CampaignStatusFilterValue>(CAMPAIGN_STATUS_FILTER_ALL);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [adSets, setAdSets] = useState<MetaAdSet[]>([]);
  const [selectedAdSetId, setSelectedAdSetId] = useState<string>("");
  const [ads, setAds] = useState<MetaAd[]>([]);
  const [selectedCompareAdSetIds, setSelectedCompareAdSetIds] = useState<string[]>([]);
  const [selectedCompareAdIds, setSelectedCompareAdIds] = useState<string[]>([]);
  const [adSetComparison, setAdSetComparison] = useState<StructureComparisonPayload | null>(null);
  const [adComparison, setAdComparison] = useState<StructureComparisonPayload | null>(null);
  const [verticalBudget, setVerticalBudget] = useState<VerticalBudgetSummary | null>(null);
  const [rangeDays, setRangeDays] = useState<RangeDays>(7);
  const [reportData, setReportData] = useState<DashboardPayload | null>(null);
  const [loadingCampaigns, setLoadingCampaigns] = useState<boolean>(true);
  const [loadingAdSets, setLoadingAdSets] = useState<boolean>(false);
  const [loadingAds, setLoadingAds] = useState<boolean>(false);
  const [loadingAdSetComparison, setLoadingAdSetComparison] = useState<boolean>(false);
  const [loadingAdComparison, setLoadingAdComparison] = useState<boolean>(false);
  const [loadingVerticalBudget, setLoadingVerticalBudget] = useState<boolean>(false);
  const [loadingPerformance, setLoadingPerformance] = useState<boolean>(false);
  const [manualRefreshing, setManualRefreshing] = useState<boolean>(false);
  const [pdfGenerating, setPdfGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [structureErrorMessage, setStructureErrorMessage] = useState<string>("");
  const [adSetComparisonErrorMessage, setAdSetComparisonErrorMessage] = useState<string>("");
  const [adComparisonErrorMessage, setAdComparisonErrorMessage] = useState<string>("");
  const [adSetComparisonRetryInSeconds, setAdSetComparisonRetryInSeconds] = useState<number | null>(null);
  const [adComparisonRetryInSeconds, setAdComparisonRetryInSeconds] = useState<number | null>(null);
  const [verticalBudgetErrorMessage, setVerticalBudgetErrorMessage] = useState<string>("");
  const isMountedRef = useRef<boolean>(true);
  const pdfGenerationCleanupRef = useRef<(() => void) | null>(null);

  const verticalOptions = useMemo(() => [...SUPPORTED_VERTICALS], []);
  const selectedVerticalSupported = useMemo(
    () => resolveSupportedVertical(selectedVertical ?? ""),
    [selectedVertical]
  );

  const filteredCampaigns = useMemo(() => {
    let nextCampaigns = campaigns;

    if (selectedVertical !== ALL_VERTICALS_VALUE) {
      nextCampaigns = nextCampaigns.filter(
        (campaign) => resolveSupportedVertical(campaign.verticalTag) === selectedVerticalSupported
      );
    }

    if (campaignStatusFilter !== CAMPAIGN_STATUS_FILTER_ALL) {
      nextCampaigns = nextCampaigns.filter(
        (campaign) => campaign.deliveryGroup === campaignStatusFilter
      );
    }

    const sorted = [...nextCampaigns];
    sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [campaignStatusFilter, campaigns, selectedVertical, selectedVerticalSupported]);

  const hasFilteredCampaigns = filteredCampaigns.length > 0;
  const noCampaignsForSelectedVertical = !loadingCampaigns && !hasFilteredCampaigns;
  const isRefreshingData =
    manualRefreshing || loadingCampaigns || loadingPerformance || loadingVerticalBudget;
  const adSetNameById = useMemo(() => {
    return new Map(adSets.map((adSet) => [adSet.id, adSet.name]));
  }, [adSets]);
  const adNameById = useMemo(() => {
    return new Map(ads.map((ad) => [ad.id, ad.name]));
  }, [ads]);

  const loadCampaigns = useCallback(async (refresh = false): Promise<void> => {
    setLoadingCampaigns(true);

    try {
      const query = new URLSearchParams({
        rangeDays: String(rangeDays)
      });

      if (refresh) {
        query.set("refresh", "1");
      }

      const response = await requestJson<CampaignsResponse>(
        `/api/meta/campaigns?${query.toString()}`
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
  }, [rangeDays]);

  const loadVerticalBudget = useCallback(
    async (verticalTag: string, refresh = false): Promise<void> => {
      if (!verticalTag || verticalTag === ALL_VERTICALS_VALUE) {
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

  const loadStructureComparison = useCallback(
    async (
      entityType: StructureComparisonEntityType,
      entityIds: string[],
      forceRefresh = false,
      signal?: AbortSignal
    ): Promise<StructureComparisonPayload | null> => {
      if (!selectedCampaignId || entityIds.length !== 2) {
        return null;
      }

      const query = new URLSearchParams({
        campaignId: selectedCampaignId,
        entityType,
        entityIds: entityIds.join(","),
        rangeDays: String(rangeDays)
      });

      if (forceRefresh) {
        query.set("refresh", "1");
      }

      const response = await requestJson<StructureComparisonResponse>(
        `/api/meta/compare?${query.toString()}`,
        {
          signal
        }
      );

      if (!response.data) {
        throw new Error("Resposta de comparação vazia");
      }

      return response.data;
    },
    [rangeDays, selectedCampaignId]
  );

  const loadAdSetComparison = useCallback(
    async (
      entityIds: string[],
      forceRefresh = false,
      signal?: AbortSignal
    ): Promise<void> => {
      if (entityIds.length !== 2) {
        setAdSetComparison(null);
        setAdSetComparisonErrorMessage("");
        return;
      }

      setLoadingAdSetComparison(true);

      try {
        const payload = await loadStructureComparison("ADSET", entityIds, forceRefresh, signal);
        if (signal?.aborted) {
          return;
        }
        setAdSetComparison(payload);
        setAdSetComparisonErrorMessage("");
        if (payload?.isContingencySnapshot && payload.retryAfterSeconds) {
          setAdSetComparisonRetryInSeconds(payload.retryAfterSeconds);
        } else {
          setAdSetComparisonRetryInSeconds(null);
        }
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Erro ao comparar grupos de anúncios";
        const retryAfterSeconds = extractRetryAfterSecondsFromMessage(message);
        setAdSetComparison(null);
        setAdSetComparisonErrorMessage(
          `Comparação de grupos: ${message}`
        );
        setAdSetComparisonRetryInSeconds(retryAfterSeconds);
      } finally {
        if (!signal?.aborted) {
          setLoadingAdSetComparison(false);
        }
      }
    },
    [loadStructureComparison]
  );

  const loadAdComparison = useCallback(
    async (
      entityIds: string[],
      forceRefresh = false,
      signal?: AbortSignal
    ): Promise<void> => {
      if (entityIds.length !== 2) {
        setAdComparison(null);
        setAdComparisonErrorMessage("");
        return;
      }

      setLoadingAdComparison(true);

      try {
        const payload = await loadStructureComparison("AD", entityIds, forceRefresh, signal);
        if (signal?.aborted) {
          return;
        }
        setAdComparison(payload);
        setAdComparisonErrorMessage("");
        if (payload?.isContingencySnapshot && payload.retryAfterSeconds) {
          setAdComparisonRetryInSeconds(payload.retryAfterSeconds);
        } else {
          setAdComparisonRetryInSeconds(null);
        }
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
        const message = error instanceof Error ? error.message : "Erro ao comparar anúncios";
        const retryAfterSeconds = extractRetryAfterSecondsFromMessage(message);
        setAdComparison(null);
        setAdComparisonErrorMessage(
          `Comparação de anúncios: ${message}`
        );
        setAdComparisonRetryInSeconds(retryAfterSeconds);
      } finally {
        if (!signal?.aborted) {
          setLoadingAdComparison(false);
        }
      }
    },
    [loadStructureComparison]
  );

  const toggleAdSetComparisonSelection = useCallback((adSetId: string): void => {
    setSelectedCompareAdSetIds((previous) => {
      if (previous.includes(adSetId)) {
        return previous.filter((id) => id !== adSetId);
      }

      if (previous.length >= 2) {
        return previous;
      }

      return [...previous, adSetId];
    });
  }, []);

  const toggleAdComparisonSelection = useCallback((adId: string): void => {
    setSelectedCompareAdIds((previous) => {
      if (previous.includes(adId)) {
        return previous.filter((id) => id !== adId);
      }

      if (previous.length >= 2) {
        return previous;
      }

      return [...previous, adId];
    });
  }, []);

  useEffect(() => {
    void loadCampaigns(false);
  }, [loadCampaigns]);

  useEffect(() => {
    void loadVerticalBudget(selectedVerticalSupported ?? "", false);
  }, [loadVerticalBudget, selectedVerticalSupported]);

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
      setSelectedCompareAdSetIds([]);
      setSelectedCompareAdIds([]);
      setAdSetComparison(null);
      setAdComparison(null);
      setAdSetComparisonRetryInSeconds(null);
      setAdComparisonRetryInSeconds(null);
    }
  }, [filteredCampaigns]);

  useEffect(() => {
    if (filteredCampaigns.length === 0 || !selectedCampaignId) {
      return;
    }

    const selectedCampaignIsVisible = filteredCampaigns.some(
      (campaign) => campaign.id === selectedCampaignId
    );
    if (!selectedCampaignIsVisible) {
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
  }, [filteredCampaigns, loadCampaignAdSets, loadPerformance, selectedCampaignId]);

  useEffect(() => {
    const shouldForceRefreshAds = adSetRefreshRequestedRef.current;
    if (shouldForceRefreshAds) {
      adSetRefreshRequestedRef.current = false;
    }

    void loadAdSetAds(selectedAdSetId, shouldForceRefreshAds);
  }, [loadAdSetAds, selectedAdSetId]);

  useEffect(() => {
    setSelectedCompareAdSetIds((previous) =>
      previous.filter((id) => adSets.some((adSet) => adSet.id === id))
    );
  }, [adSets]);

  useEffect(() => {
    setSelectedCompareAdIds((previous) => previous.filter((id) => ads.some((ad) => ad.id === id)));
  }, [ads]);

  useEffect(() => {
    if (selectedCompareAdSetIds.length !== 2) {
      setAdSetComparison(null);
      setAdSetComparisonErrorMessage("");
      setLoadingAdSetComparison(false);
      setAdSetComparisonRetryInSeconds(null);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      void loadAdSetComparison(selectedCompareAdSetIds, false, controller.signal);
    }, 350);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [loadAdSetComparison, selectedCompareAdSetIds]);

  useEffect(() => {
    if (selectedCompareAdIds.length !== 2) {
      setAdComparison(null);
      setAdComparisonErrorMessage("");
      setLoadingAdComparison(false);
      setAdComparisonRetryInSeconds(null);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      void loadAdComparison(selectedCompareAdIds, false, controller.signal);
    }, 350);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [loadAdComparison, selectedCompareAdIds]);

  useEffect(() => {
    if (adSetComparisonRetryInSeconds === null || adSetComparisonRetryInSeconds <= 0) {
      return;
    }

    const timeout = setTimeout(() => {
      setAdSetComparisonRetryInSeconds((previous) => {
        if (previous === null) {
          return previous;
        }

        return previous > 0 ? previous - 1 : previous;
      });
    }, 1000);

    return () => clearTimeout(timeout);
  }, [adSetComparisonRetryInSeconds]);

  useEffect(() => {
    if (adComparisonRetryInSeconds === null || adComparisonRetryInSeconds <= 0) {
      return;
    }

    const timeout = setTimeout(() => {
      setAdComparisonRetryInSeconds((previous) => {
        if (previous === null) {
          return previous;
        }

        return previous > 0 ? previous - 1 : previous;
      });
    }, 1000);

    return () => clearTimeout(timeout);
  }, [adComparisonRetryInSeconds]);

  useEffect(() => {
    if (adSetComparisonRetryInSeconds !== 0) {
      return;
    }

    setAdSetComparisonRetryInSeconds(null);
    if (selectedCompareAdSetIds.length === 2) {
      void loadAdSetComparison(selectedCompareAdSetIds, true);
    }
  }, [adSetComparisonRetryInSeconds, loadAdSetComparison, selectedCompareAdSetIds]);

  useEffect(() => {
    if (adComparisonRetryInSeconds !== 0) {
      return;
    }

    setAdComparisonRetryInSeconds(null);
    if (selectedCompareAdIds.length === 2) {
      void loadAdComparison(selectedCompareAdIds, true);
    }
  }, [adComparisonRetryInSeconds, loadAdComparison, selectedCompareAdIds]);

  const handleCampaignChange = useCallback((campaignId: string): void => {
    campaignRefreshRequestedRef.current = campaignId;
    setSelectedCompareAdSetIds([]);
    setSelectedCompareAdIds([]);
    setAdSetComparison(null);
    setAdComparison(null);
    setAdSetComparisonErrorMessage("");
    setAdComparisonErrorMessage("");
    setAdSetComparisonRetryInSeconds(null);
    setAdComparisonRetryInSeconds(null);
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
      const adSetCompareIdsForRefresh = [...selectedCompareAdSetIds];
      const adCompareIdsForRefresh = [...selectedCompareAdIds];

      await Promise.all([
        loadCampaigns(true),
        loadVerticalBudget(selectedVerticalSupported ?? "", true)
      ]);

      if (campaignIdForRefresh) {
        await Promise.all([
          loadPerformance(true),
          loadCampaignAdSets(campaignIdForRefresh, true)
        ]);

        if (adSetIdForRefresh) {
          await loadAdSetAds(adSetIdForRefresh, true);
        }

        if (adSetCompareIdsForRefresh.length === 2) {
          await loadAdSetComparison(adSetCompareIdsForRefresh, true);
        }

        if (adCompareIdsForRefresh.length === 2) {
          await loadAdComparison(adCompareIdsForRefresh, true);
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
    loadAdComparison,
    loadAdSetComparison,
    loadVerticalBudget,
    selectedAdSetId,
    selectedCompareAdIds,
    selectedCompareAdSetIds,
    selectedCampaignId,
    selectedVerticalSupported
  ]);

  const pdfUrl = useMemo(() => {
    if (!selectedVertical) {
      return "";
    }

    const query = new URLSearchParams({
      rangeDays: String(rangeDays)
    });

    if (selectedVerticalSupported) {
      query.set("verticalTag", selectedVerticalSupported);
    }

    if (selectedCampaignId) {
      query.set("campaignId", selectedCampaignId);
    }

    return `/api/pdf?${query.toString()}`;
  }, [rangeDays, selectedCampaignId, selectedVertical, selectedVerticalSupported]);

  const handleGeneratePdf = useCallback((): void => {
    if (!pdfUrl || pdfGenerating) {
      return;
    }

    if (pdfGenerationCleanupRef.current) {
      pdfGenerationCleanupRef.current();
      pdfGenerationCleanupRef.current = null;
    }

    flushSync(() => {
      setPdfGenerating(true);
    });

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const finish = (): void => {
      if (isMountedRef.current) {
        setPdfGenerating(false);
      }

      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      window.removeEventListener("blur", finish);
      pdfGenerationCleanupRef.current = null;
    };

    pdfGenerationCleanupRef.current = finish;

    window.addEventListener("blur", finish, { once: true });

    timeoutId = setTimeout(finish, 15000);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.location.assign(pdfUrl);
      });
    });
  }, [pdfGenerating, pdfUrl]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (pdfGenerationCleanupRef.current) {
        pdfGenerationCleanupRef.current();
        pdfGenerationCleanupRef.current = null;
      }
    };
  }, []);

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
      <header data-dashboard-block="header" className="surface-panel enter-fade p-6">
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
              onClick={handleGeneratePdf}
              disabled={loadingCampaigns || loadingPerformance || loadingVerticalBudget || pdfGenerating}
              className="hover-lift inline-flex h-11 w-[190px] items-center justify-center gap-2 rounded-xl border border-viasoft/80 bg-viasoft/5 px-4 text-sm font-semibold text-viasoft transition hover:bg-viasoft hover:text-white active:bg-viasoft-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viasoft/25 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
            >
              {pdfGenerating ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
              {pdfGenerating ? "Gerando PDF..." : "Gerar PDF"}
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
              className="hover-lift inline-flex h-11 w-[190px] items-center justify-center gap-2 rounded-xl bg-viasoft px-4 text-sm font-semibold text-white shadow-sm shadow-viasoft/25 transition hover:bg-viasoft-700 active:bg-viasoft-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viasoft/25 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <RefreshCw size={16} className={isRefreshingData ? "animate-spin" : ""} />
              {isRefreshingData ? "Atualizando dados..." : "Atualizar Dados"}
            </button>
          </div>
        </div>
      </header>

      <section data-dashboard-block="filters" className="surface-panel mt-5 p-5 sm:p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6 lg:items-end">
          <div className="min-w-0 lg:col-span-1">
            <VerticalSelector
              verticals={verticalOptions}
              value={selectedVertical}
              onChange={setSelectedVertical}
              disabled={loadingCampaigns}
              allOptionValue={ALL_VERTICALS_VALUE}
            />
          </div>
          <div className="min-w-0 lg:col-span-1">
            <OptionSelector
              label="Veiculação"
              value={campaignStatusFilter}
              onChange={(nextValue) => setCampaignStatusFilter(nextValue as CampaignStatusFilterValue)}
              options={DELIVERY_STATUS_FILTERS.map((status) => ({
                value: status.value,
                label: status.label
              }))}
              ariaLabel="Seleção de veiculação"
              disabled={loadingCampaigns}
            />
          </div>
          <div className="min-w-0 md:col-span-2 lg:col-span-3">
            <CampaignSelector
              campaigns={filteredCampaigns}
              value={selectedCampaignId}
              onChange={handleCampaignChange}
              disabled={loadingCampaigns || !hasFilteredCampaigns}
            />
          </div>
          <div className="min-w-0 md:col-span-2 lg:col-span-1">
            <PeriodSelector
              value={rangeDays}
              onChange={setRangeDays}
              disabled={loadingCampaigns || !hasFilteredCampaigns || !selectedCampaignId}
            />
          </div>
        </div>
        <div data-dashboard-block="vertical-budget" className="mt-4 border-t border-slate-200 pt-4">
          {selectedVertical === ALL_VERTICALS_VALUE ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Selecione uma vertical específica para visualizar o orçamento mensal.
            </div>
          ) : loadingVerticalBudget ? (
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
              <p className="mt-1">
                Não há campanhas para os filtros atuais. Ajuste status ou período para ampliar a
                análise.
              </p>
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
            selectedCompareAdSetIds={selectedCompareAdSetIds}
            onToggleCompareAdSet={toggleAdSetComparisonSelection}
            selectedCompareAdIds={selectedCompareAdIds}
            onToggleCompareAd={toggleAdComparisonSelection}
            loadingAdSets={loadingAdSets}
            loadingAds={loadingAds}
            errorMessage={structureErrorMessage}
          />
          {selectedCompareAdSetIds.length > 0 ? (
            <StructureComparisonSection
              entityType="ADSET"
              selectedIds={selectedCompareAdSetIds}
              resolveName={(id) => adSetNameById.get(id) ?? id}
              comparison={adSetComparison}
              loading={loadingAdSetComparison}
              errorMessage={adSetComparisonErrorMessage}
              retryInSeconds={adSetComparisonRetryInSeconds}
            />
          ) : null}
          {selectedCompareAdIds.length > 0 ? (
            <StructureComparisonSection
              entityType="AD"
              selectedIds={selectedCompareAdIds}
              resolveName={(id) => adNameById.get(id) ?? id}
              comparison={adComparison}
              loading={loadingAdComparison}
              errorMessage={adComparisonErrorMessage}
              retryInSeconds={adComparisonRetryInSeconds}
            />
          ) : null}
          <DashboardReport data={reportData} hideCampaignHeader />
          <p className="text-right text-xs text-slate-500">
            Atualizado em {new Date(reportData.generatedAt).toLocaleString("pt-BR")}
          </p>
        </section>
      ) : null}
    </main>
  );
}
