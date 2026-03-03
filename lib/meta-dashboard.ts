import { cache } from "@/lib/cache";
import {
  adPreviewCacheKey,
  adSetsCacheKey,
  adsCacheKey,
  CAMPAIGNS_CACHE_KEY,
  performanceCacheKey,
  performanceCachePrefix
} from "@/lib/cache-keys";
import type {
  DashboardPayload,
  MetaAd,
  MetaAdPreview,
  MetaAdSet,
  MetaCampaign,
  RangeDays
} from "@/lib/types";
import {
  fetchAdPreview,
  fetchAdSetAds,
  fetchActiveCampaigns,
  fetchCampaignAdSets,
  fetchCampaignById,
  fetchCampaignInsights
} from "@/services/meta-api";
import { buildDateRange, isValidRangeDays } from "@/utils/date-range";
import { generateInsights } from "@/utils/insights-engine";
import {
  buildDailyMetricPoints,
  buildMetricComparison,
  buildMetricSnapshot
} from "@/utils/metrics";

const CACHE_TTL_MS = 5 * 60 * 1000;
const STALE_MAX_AGE_MS = 15 * 60 * 1000;

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

  if (fromApi.effectiveStatus.toUpperCase() !== "ACTIVE") {
    throw new Error("Apenas campanhas ativadas são suportadas no MVP");
  }

  if (fromApi.deliveryStatus !== "ACTIVE") {
    throw new Error("A campanha selecionada não possui veiculação ativa.");
  }

  return fromApi;
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

    const [currentRows, previousRows, dailyRows] = await Promise.all([
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
      })
    ]);

    const currentSnapshot = buildMetricSnapshot(currentRows, campaign.objectiveCategory);
    const previousSnapshot = buildMetricSnapshot(previousRows, campaign.objectiveCategory);
    const comparison = buildMetricComparison(currentSnapshot, previousSnapshot);
    const chart = buildDailyMetricPoints(dailyRows, campaign.objectiveCategory);

    const { insights, recommendations } = generateInsights({
      category: campaign.objectiveCategory,
      comparison
    });

    const payload: DashboardPayload = {
      campaign,
      range,
      comparison,
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

export function invalidateCampaignRangeCache(campaignId: string, rangeDays: RangeDays): number {
  return cache.deleteByPrefix(performanceCachePrefix(campaignId, rangeDays));
}

export function invalidateCampaignsCache(): void {
  cache.delete(CAMPAIGNS_CACHE_KEY);
}

export function invalidateAllCache(): void {
  cache.clear();
}
