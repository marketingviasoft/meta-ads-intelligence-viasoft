import type { RangeDays } from "@/lib/types";

export const CAMPAIGNS_CACHE_KEY = "campaigns:active";
const CAMPAIGNS_CATALOG_CACHE_PREFIX = "campaigns:catalog";
const ADS_CACHE_VERSION = "v2";
const AD_PREVIEW_CACHE_VERSION = "v1";

export function adSetsCacheKey(campaignId: string): string {
  return `structure:adsets:${campaignId}`;
}

export function adSetsCachePrefix(campaignId: string): string {
  return `structure:adsets:${campaignId}`;
}

export function adsCacheKey(adSetId: string): string {
  return `structure:ads:${ADS_CACHE_VERSION}:${adSetId}`;
}

export function adsCachePrefix(adSetId: string): string {
  return `structure:ads:${ADS_CACHE_VERSION}:${adSetId}`;
}

export function adPreviewCacheKey(adId: string): string {
  return `structure:ad-preview:${AD_PREVIEW_CACHE_VERSION}:${adId}`;
}

export function adPreviewCachePrefix(adId: string): string {
  return `structure:ad-preview:${AD_PREVIEW_CACHE_VERSION}:${adId}`;
}

export function performanceCacheKey(
  campaignId: string,
  rangeDays: RangeDays,
  rangeUntil: string
): string {
  return `performance:${campaignId}:${rangeDays}:${rangeUntil}`;
}

export function performanceCachePrefix(campaignId: string, rangeDays: RangeDays): string {
  return `performance:${campaignId}:${rangeDays}:`;
}

export function campaignsCatalogCacheKey(rangeDays: RangeDays, rangeUntil: string): string {
  return `${CAMPAIGNS_CATALOG_CACHE_PREFIX}:${rangeDays}:${rangeUntil}`;
}

export function campaignsCatalogCachePrefix(): string {
  return `${CAMPAIGNS_CATALOG_CACHE_PREFIX}:`;
}

export function verticalBudgetCacheKey(verticalTag: string, monthUntil: string): string {
  const normalizedVertical = encodeURIComponent((verticalTag || "sem-vertical").trim().toLowerCase());
  return `budget:vertical:${normalizedVertical}:${monthUntil}`;
}
