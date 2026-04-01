import { cache } from "@/lib/cache";
import {
  adPreviewCacheKey,
  adSetsCacheKey,
  adsCacheKey,
  CAMPAIGNS_CACHE_KEY,
  campaignsCatalogCacheKey,
  campaignsCatalogCachePrefix,
  structureComparisonCacheKey,
  verticalBudgetCacheKey,
  performanceCacheKey,
  performanceCachePrefix
} from "@/lib/cache-keys";
import type {
  DashboardPayload,
  MetaAd,
  MetaAdPreview,
  MetaAdSet,
  MetaCampaign,
  RangeDays,
  StructureComparisonEntityType,
  StructureComparisonPayload,
  StructureComparisonItem,
  VerticalBudgetSummary
} from "@/lib/types";
import {
  fetchAdInsights,
  fetchAdPreview,
  fetchAdSetInsights,
  fetchAdSetAds,
  fetchActiveCampaigns,
  fetchCampaignActivityByRange,
  fetchCampaignCatalog,
  fetchVerticalSpendInMonthRange,
  fetchCampaignAdSets,
  fetchCampaignById,
  fetchCampaignInsights
} from "@/services/meta-api";
import { buildDateRange, isValidRangeDays } from "@/utils/date-range";
import { generateInsights } from "@/utils/insights-engine";
import { buildCurrentMonthToCurrentDateRange } from "@/utils/month-range";
import {
  buildDailyMetricPoints,
  buildMetricComparison,
  buildMetricSnapshot
} from "@/utils/metrics";
import {
  DEFAULT_VERTICAL_MONTHLY_CAP,
  VIASOFT_VERTICAL_MONTHLY_CAP
} from "@/lib/constants";

const CACHE_TTL_MS = 5 * 60 * 1000;
const STALE_MAX_AGE_MS = 15 * 60 * 1000;
const structureComparisonInFlight = new Map<string, Promise<StructureComparisonPayload>>();

function isMetaRateLimitOrCooldownError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  return (
    normalized.includes("cooldown") ||
    normalized.includes("limite de requests") ||
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("429") ||
    normalized.includes("code 17")
  );
}

function extractRetryAfterSeconds(message: string): number | undefined {
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

  return undefined;
}

function getStaleCacheValue<T>(key: string): T | null {
  const withOptionalStale = cache as typeof cache & {
    getStale?: <U>(cacheKey: string, maxAgeMs?: number) => U | null;
  };

  if (typeof withOptionalStale.getStale === "function") {
    return withOptionalStale.getStale<T>(key, STALE_MAX_AGE_MS);
  }

  return cache.get<T>(key);
}

export async function getActiveCampaigns(forceRefresh = false): Promise<MetaCampaign[]> {
  const stale = getStaleCacheValue<MetaCampaign[]>(CAMPAIGNS_CACHE_KEY);
  const cached = cache.get<MetaCampaign[]>(CAMPAIGNS_CACHE_KEY);
  if (cached && !forceRefresh) {
    return cached;
  }

  try {
    const campaigns = await fetchActiveCampaigns();
    cache.set(CAMPAIGNS_CACHE_KEY, campaigns, CACHE_TTL_MS);
    return campaigns;
  } catch (error) {
    if (stale) {
      return stale;
    }

    throw error;
  }
}

export async function getCampaignCatalog(
  rangeDays: RangeDays,
  forceRefresh = false
): Promise<MetaCampaign[]> {
  if (!isValidRangeDays(rangeDays)) {
    throw new Error("Período inválido. Use 7, 14, 28 ou 30 dias.");
  }

  const range = buildDateRange(rangeDays);
  const cacheKey = campaignsCatalogCacheKey(rangeDays, range.until);
  const stale = getStaleCacheValue<MetaCampaign[]>(cacheKey);
  const cached = cache.get<MetaCampaign[]>(cacheKey);

  if (cached && !forceRefresh) {
    return cached;
  }

  try {
    const [campaigns, activityByCampaign] = await Promise.all([
      fetchCampaignCatalog(),
      fetchCampaignActivityByRange({
        since: range.since,
        until: range.until
      })
    ]);

    const catalog = campaigns.map((campaign) => {
      const activity = activityByCampaign.get(campaign.id);
      return {
        ...campaign,
        hasActivityInRange: (activity?.spend ?? 0) > 0 || (activity?.impressions ?? 0) > 0,
        periodSpend: activity?.spend ?? 0,
        periodImpressions: activity?.impressions ?? 0,
        periodClicks: activity?.clicks ?? 0
      };
    });

    cache.set(cacheKey, catalog, CACHE_TTL_MS);
    return catalog;
  } catch (error) {
    if (stale) {
      return stale;
    }

    throw error;
  }
}

export async function getCampaignAdSets(
  campaignId: string,
  forceRefresh = false
): Promise<MetaAdSet[]> {
  const cacheKey = adSetsCacheKey(campaignId);

  const stale = getStaleCacheValue<MetaAdSet[]>(cacheKey);
  const cached = cache.get<MetaAdSet[]>(cacheKey);
  if (cached && !forceRefresh) {
    return cached;
  }

  try {
    const adSets = await fetchCampaignAdSets(campaignId);
    cache.set(cacheKey, adSets, CACHE_TTL_MS);
    return adSets;
  } catch (error) {
    if (stale) {
      return stale;
    }

    throw error;
  }
}

export async function getAdSetAds(adSetId: string, forceRefresh = false): Promise<MetaAd[]> {
  const cacheKey = adsCacheKey(adSetId);

  const stale = getStaleCacheValue<MetaAd[]>(cacheKey);
  const cached = cache.get<MetaAd[]>(cacheKey);
  if (cached && !forceRefresh) {
    return cached;
  }

  try {
    const ads = await fetchAdSetAds(adSetId);
    cache.set(cacheKey, ads, CACHE_TTL_MS);
    return ads;
  } catch (error) {
    if (stale) {
      return stale;
    }

    throw error;
  }
}

export async function getAdPreview(adId: string, forceRefresh = false): Promise<MetaAdPreview> {
  const cacheKey = adPreviewCacheKey(adId);

  const stale = getStaleCacheValue<MetaAdPreview>(cacheKey);
  const cached = cache.get<MetaAdPreview>(cacheKey);
  if (cached && !forceRefresh) {
    return cached;
  }

  try {
    const preview = await fetchAdPreview(adId);
    cache.set(cacheKey, preview, CACHE_TTL_MS);
    return preview;
  } catch (error) {
    if (stale) {
      return stale;
    }

    throw error;
  }
}

async function resolveCampaign(campaignId: string, forceRefresh = false): Promise<MetaCampaign> {
  const activeCampaigns = await getActiveCampaigns(forceRefresh);
  const selectedFromCache = activeCampaigns.find((campaign) => campaign.id === campaignId);

  if (selectedFromCache) {
    return selectedFromCache;
  }

  const refreshedCampaigns = await getActiveCampaigns(true);
  const selectedAfterRefresh = refreshedCampaigns.find((campaign) => campaign.id === campaignId);

  if (selectedAfterRefresh) {
    return selectedAfterRefresh;
  }

  const fromApi = await fetchCampaignById(campaignId);
  if (!fromApi) {
    throw new Error("Campanha não encontrada");
  }

  return fromApi;
}

function resolveVerticalMonthlyCap(verticalTag: string): number {
  if (verticalTag.localeCompare("VIASOFT", "pt-BR", { sensitivity: "base" }) === 0) {
    return VIASOFT_VERTICAL_MONTHLY_CAP;
  }

  const rawCap = process.env.VERTICAL_MONTHLY_CAP_BRL;
  if (!rawCap) {
    return DEFAULT_VERTICAL_MONTHLY_CAP;
  }

  const parsed = Number.parseFloat(rawCap);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_VERTICAL_MONTHLY_CAP;
  }

  return parsed;
}

export async function getVerticalBudgetSummary(params: {
  verticalTag: string;
  forceRefresh?: boolean;
}): Promise<VerticalBudgetSummary> {
  const { verticalTag, forceRefresh = false } = params;
  const monthRange = buildCurrentMonthToCurrentDateRange();
  const monthlyCap = resolveVerticalMonthlyCap(verticalTag);
  const cacheKey = verticalBudgetCacheKey(verticalTag, monthRange.until);

  const staleBudget = getStaleCacheValue<VerticalBudgetSummary>(cacheKey);
  const cachedBudget = cache.get<VerticalBudgetSummary>(cacheKey);

  if (cachedBudget && !forceRefresh) {
    return cachedBudget;
  }

  try {
    const spentInMonth = monthRange.hasElapsedDays
      ? await fetchVerticalSpendInMonthRange({
          verticalTag,
          since: monthRange.since,
          until: monthRange.dataUntil
        })
      : 0;

    const remainingInMonth = Math.max(monthlyCap - spentInMonth, 0);
    const overBudgetAmount = Math.max(spentInMonth - monthlyCap, 0);
    const utilizationPercent = monthlyCap > 0 ? (spentInMonth / monthlyCap) * 100 : 0;

    const summary: VerticalBudgetSummary = {
      verticalTag,
      monthlyCap,
      monthSince: monthRange.since,
      monthUntil: monthRange.until,
      dataUntil: monthRange.dataUntil,
      spentInMonth,
      remainingInMonth,
      overBudgetAmount,
      utilizationPercent,
      hasElapsedDays: monthRange.hasElapsedDays,
      includesCurrentDay: monthRange.includesCurrentDay,
      timezone: monthRange.timeZone
    };

    cache.set(cacheKey, summary, CACHE_TTL_MS);
    return summary;
  } catch (error) {
    if (staleBudget) {
      return staleBudget;
    }

    throw error;
  }
}

export async function getDashboardPayload(params: {
  campaignId: string;
  rangeDays: RangeDays;
  forceRefresh?: boolean;
}): Promise<DashboardPayload> {
  const { campaignId, rangeDays, forceRefresh = false } = params;

  if (!isValidRangeDays(rangeDays)) {
    throw new Error("Período inválido. Use 7, 14, 28 ou 30 dias.");
  }

  const range = buildDateRange(rangeDays);
  const cacheKey = performanceCacheKey(campaignId, rangeDays, range.until);

  const stalePayload = getStaleCacheValue<DashboardPayload>(cacheKey);
  const cachedPayload = cache.get<DashboardPayload>(cacheKey);
  if (cachedPayload && !forceRefresh) {
    return cachedPayload;
  }

  try {
    const campaign = await resolveCampaign(campaignId, forceRefresh);

    const [currentRows, previousRows, dailyRows, verticalBudget] = await Promise.all([
      fetchCampaignInsights({
        campaignId,
        since: range.since,
        until: range.until
      }),
      fetchCampaignInsights({
        campaignId,
        since: range.previousSince,
        until: range.previousUntil
      }),
      fetchCampaignInsights({
        campaignId,
        since: range.since,
        until: range.until,
        timeIncrement: 1
      }),
      getVerticalBudgetSummary({
        verticalTag: campaign.verticalTag,
        forceRefresh
      })
    ]);

    const currentSnapshot = buildMetricSnapshot(currentRows, campaign.objectiveCategory);
    const previousSnapshot = buildMetricSnapshot(previousRows, campaign.objectiveCategory);
    const comparison = buildMetricComparison(currentSnapshot, previousSnapshot);
    const chart = buildDailyMetricPoints(dailyRows, campaign.objectiveCategory);

    const { insights, recommendations } = generateInsights({
      category: campaign.objectiveCategory,
      comparison,
      verticalTag: campaign.verticalTag
    });

    const payload: DashboardPayload = {
      campaign,
      range,
      comparison,
      verticalBudget,
      chart,
      insights,
      recommendations,
      generatedAt: new Date().toISOString()
    };

    cache.set(cacheKey, payload, CACHE_TTL_MS);
    return payload;
  } catch (error) {
    if (stalePayload) {
      return stalePayload;
    }

    throw error;
  }
}

async function fetchStructureEntityInsights(params: {
  entityType: StructureComparisonEntityType;
  entityId: string;
  since: string;
  until: string;
}) {
  const { entityType, entityId, since, until } = params;

  if (entityType === "ADSET") {
    return fetchAdSetInsights({
      adSetId: entityId,
      since,
      until
    });
  }

  return fetchAdInsights({
    adId: entityId,
    since,
    until
  });
}

export async function getStructureComparisonPayload(params: {
  campaignId: string;
  entityType: StructureComparisonEntityType;
  entityIds: string[];
  rangeDays: RangeDays;
  forceRefresh?: boolean;
}): Promise<StructureComparisonPayload> {
  const { campaignId, entityType, entityIds, rangeDays, forceRefresh = false } = params;

  if (!isValidRangeDays(rangeDays)) {
    throw new Error("Período inválido. Use 7, 14, 28 ou 30 dias.");
  }

  const uniqueIds = [...new Set(entityIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length !== 2) {
    throw new Error("Selecione exatamente 2 itens para comparação.");
  }

  const range = buildDateRange(rangeDays);
  const cacheKey = structureComparisonCacheKey(
    entityType,
    campaignId,
    rangeDays,
    range.until,
    uniqueIds
  );

  const stalePayload = getStaleCacheValue<StructureComparisonPayload>(cacheKey);
  const cachedPayload = cache.get<StructureComparisonPayload>(cacheKey);

  if (cachedPayload && !forceRefresh) {
    return {
      ...cachedPayload,
      isContingencySnapshot: false,
      contingencyReason: undefined
    };
  }

  const inFlight = structureComparisonInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const runner = (async (): Promise<StructureComparisonPayload> => {
    try {
      const campaign = await resolveCampaign(campaignId, forceRefresh);

      const items = await Promise.all(
        uniqueIds.map(async (entityId): Promise<StructureComparisonItem> => {
          const [currentRows, previousRows] = await Promise.all([
            fetchStructureEntityInsights({
              entityType,
              entityId,
              since: range.since,
              until: range.until
            }),
            fetchStructureEntityInsights({
              entityType,
              entityId,
              since: range.previousSince,
              until: range.previousUntil
            })
          ]);

          const current = buildMetricSnapshot(currentRows, campaign.objectiveCategory);
          const previous = buildMetricSnapshot(previousRows, campaign.objectiveCategory);
          const comparison = buildMetricComparison(current, previous);

          return {
            id: entityId,
            current,
            previous,
            deltas: comparison.deltas
          };
        })
      );

      const payload: StructureComparisonPayload = {
        entityType,
        range,
        objectiveCategory: campaign.objectiveCategory,
        items,
        generatedAt: new Date().toISOString(),
        isContingencySnapshot: false,
        contingencyReason: undefined
      };

      cache.set(cacheKey, payload, CACHE_TTL_MS);
      return payload;
    } catch (error) {
      if (stalePayload) {
        const message = error instanceof Error ? error.message : String(error ?? "");
        const retryAfterSeconds = extractRetryAfterSeconds(message);

        if (isMetaRateLimitOrCooldownError(error)) {
          return {
            ...stalePayload,
            isContingencySnapshot: true,
            contingencyReason: "Meta API em cooldown/rate limit. Exibindo último snapshot disponível.",
            retryAfterSeconds
          };
        }

        return {
          ...stalePayload,
          isContingencySnapshot: true,
          contingencyReason: "Meta API indisponível temporariamente. Exibindo último snapshot disponível.",
          retryAfterSeconds
        };
      }

      throw error;
    } finally {
      structureComparisonInFlight.delete(cacheKey);
    }
  })();

  structureComparisonInFlight.set(cacheKey, runner);
  return runner;
}

export function invalidateCampaignRangeCache(campaignId: string, rangeDays: RangeDays): number {
  return cache.deleteByPrefix(performanceCachePrefix(campaignId, rangeDays));
}

export function invalidateCampaignsCache(): void {
  cache.delete(CAMPAIGNS_CACHE_KEY);
  cache.deleteByPrefix(campaignsCatalogCachePrefix());
}

export function invalidateAllCache(): void {
  cache.clear();
}
