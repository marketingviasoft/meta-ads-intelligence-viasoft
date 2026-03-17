import { cache } from "@/lib/cache";
import {
  adSetsCacheKey,
  adsCacheKey,
  campaignsCatalogCacheKey,
  performanceCacheKey,
  structureComparisonCacheKey,
  verticalBudgetCacheKey
} from "@/lib/cache-keys";
import type {
  CampaignDeliveryGroup,
  MetaAd,
  MetaAdSet,
  CampaignLifecycleStatus,
  DashboardPayload,
  DeliveryStatus,
  MetaCampaign,
  MetricSnapshot,
  NormalizedInsightRow,
  ObjectiveCategory,
  RangeDays,
  StructureComparisonEntityType,
  StructureComparisonItem,
  StructureComparisonPayload,
  VerticalBudgetSummary
} from "@/lib/types";
import { supabase } from "@/lib/supabaseClient.js";
import { extractVerticalTagFromCampaignName, FALLBACK_VERTICAL_TAG } from "@/utils/campaign-tags";
import { buildDateRange, isValidRangeDays } from "@/utils/date-range";
import { generateInsights } from "@/utils/insights-engine";
import { buildMetricComparison, buildMetricSnapshot, buildDailyMetricPoints } from "@/utils/metrics";
import { buildCurrentMonthToCurrentDateRange } from "@/utils/month-range";
import { toNumber } from "@/utils/numbers";

type MetaCampaignInsightStoreRow = {
  date: string;
  date_stop?: string | null;
  campaign_id: string;
  campaign_name: string | null;
  adset_id?: string | null;
  adset_name?: string | null;
  ad_id?: string | null;
  ad_name?: string | null;
  objective?: string | null;
  effective_status?: string | null;
  configured_status?: string | null;
  delivery_status?: string | null;
  spend: number | string | null;
  impressions: number | string | null;
  clicks: number | string | null;
  reach?: number | string | null;
  frequency?: number | string | null;
  ctr?: number | string | null;
  cpc?: number | string | null;
  cpm?: number | string | null;
  cpp?: number | string | null;
  unique_clicks?: number | string | null;
  inline_link_clicks?: number | string | null;
  outbound_clicks?: number | string | null;
  conversions?: number | string | null;
  purchases: number | string | null;
  leads?: number | string | null;
  link_clicks?: number | string | null;
  post_engagement?: number | string | null;
  cost_per_result?: number | string | null;
  quality_ranking?: string | null;
  engagement_rate_ranking?: string | null;
  conversion_rate_ranking?: string | null;
  actions?: Record<string, unknown> | string | null;
  cost_per_action_type?: Record<string, unknown> | string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type MetaAdSetStoreRow = {
  id: string;
  campaign_id: string;
  name: string;
  status: string | null;
};

export type MetaAdStoreRow = {
  id: string;
  adset_id: string;
  campaign_id: string;
  name: string;
  status: string | null;
  creative_name: string | null;
  creative_thumb: string | null;
  demographics: Record<string, any> | null;
};

const TABLE_NAME = "meta_campaign_insights";
const ADSETS_TABLE_NAME = "meta_adsets";
const ADS_TABLE_NAME = "meta_ads";
const STORE_SELECT_FIELDS = [
  "date",
  "date_stop",
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "ad_id",
  "ad_name",
  "objective",
  "effective_status",
  "configured_status",
  "delivery_status",
  "spend",
  "impressions",
  "clicks",
  "reach",
  "frequency",
  "ctr",
  "cpc",
  "cpm",
  "cpp",
  "unique_clicks",
  "inline_link_clicks",
  "outbound_clicks",
  "conversions",
  "purchases",
  "leads",
  "link_clicks",
  "post_engagement",
  "cost_per_result",
  "quality_ranking",
  "engagement_rate_ranking",
  "conversion_rate_ranking",
  "actions",
  "cost_per_action_type",
  "created_at",
  "updated_at"
].join(",");
const CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_VERTICAL_MONTHLY_CAP = 535;
const META_INVESTMENT_TAX_RATE = 0.1215;
const VIASOFT_TOTAL_MONTHLY_CAP_WITH_TAX = 1000;
const VIASOFT_VERTICAL_MONTHLY_CAP =
  VIASOFT_TOTAL_MONTHLY_CAP_WITH_TAX / (1 + META_INVESTMENT_TAX_RATE);
const CAMPAIGN_STATUS_LOOKBACK_DAYS = 180;

function normalizeString(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function inferObjectiveFromCampaignName(campaignName: string): string {
  const match = campaignName.match(/^\s*\[[^\]]+\]\s*\[[^\]]+\]\s*\[([^\]]+)\]/u);
  const rawObjective = match?.[1]?.trim();

  if (!rawObjective) {
    return "CONVERSIONS";
  }

  return rawObjective;
}

function inferObjectiveCategory(rawObjective: string): ObjectiveCategory {
  const objective = normalizeString(rawObjective);

  if (objective.includes("trafego") || objective.includes("traffic") || objective.includes("clique")) {
    return "TRAFFIC";
  }

  if (objective.includes("engajamento") || objective.includes("engagement")) {
    return "ENGAGEMENT";
  }

  if (
    objective.includes("reconhecimento") ||
    objective.includes("awareness") ||
    objective.includes("reach")
  ) {
    return "RECOGNITION";
  }

  return "CONVERSIONS";
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

function parseMetricMap(
  value: MetaCampaignInsightStoreRow["actions"] | MetaCampaignInsightStoreRow["cost_per_action_type"]
): Record<string, number> {
  if (!value) {
    return {};
  }

  let source: unknown;
  try {
    source =
      typeof value === "string"
        ? (JSON.parse(value) as unknown)
        : (value as Record<string, unknown>);
  } catch {
    return {};
  }

  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return {};
  }

  return Object.entries(source).reduce<Record<string, number>>((accumulator, [key, raw]) => {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      return accumulator;
    }

    accumulator[normalizedKey] = toNumber(raw);
    return accumulator;
  }, {});
}

function mergeMetricMaps(
  first: Record<string, number>,
  second: Record<string, number>
): Record<string, number> {
  const merged = { ...first };

  for (const [key, value] of Object.entries(second)) {
    merged[key] = (merged[key] ?? 0) + value;
  }

  return merged;
}

async function fetchRowsByDateRange(params: {
  since: string;
  until: string;
  campaignId?: string;
}): Promise<MetaCampaignInsightStoreRow[]> {
  const { since, until, campaignId } = params;
  const pageSize = 1000;
  const rows: MetaCampaignInsightStoreRow[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from(TABLE_NAME)
      .select(STORE_SELECT_FIELDS)
      .gte("date", since)
      .lte("date", until)
      .order("date", { ascending: true });

    if (campaignId) {
      query = query.eq("campaign_id", campaignId);
    }

    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) {
      throw new Error(`Supabase: ${error.message}`);
    }

    const page = (data ?? []) as MetaCampaignInsightStoreRow[];
    if (page.length === 0) {
      break;
    }

    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return rows;
}

async function fetchLatestCampaignRow(campaignId: string): Promise<MetaCampaignInsightStoreRow | null> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(STORE_SELECT_FIELDS)
    .eq("campaign_id", campaignId)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase: ${error.message}`);
  }

  return (data as MetaCampaignInsightStoreRow | null) ?? null;
}

async function fetchAdSetRowsByCampaignId(campaignId: string): Promise<MetaAdSetStoreRow[]> {
  const pageSize = 1000;
  const rows: MetaAdSetStoreRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from(ADSETS_TABLE_NAME)
      .select("id,campaign_id,name,status")
      .eq("campaign_id", campaignId)
      .order("name", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Supabase: ${error.message}`);
    }

    const page = (data ?? []) as MetaAdSetStoreRow[];
    if (page.length === 0) {
      break;
    }

    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return rows;
}

async function fetchAdRowsByAdSetId(adSetId: string): Promise<MetaAdStoreRow[]> {
  const pageSize = 1000;
  const rows: MetaAdStoreRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from(ADS_TABLE_NAME)
      .select("id,adset_id,campaign_id,name,status,creative_name,creative_thumb,demographics")
      .eq("adset_id", adSetId)
      .order("name", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Supabase: ${error.message}`);
    }

    const page = (data ?? []) as MetaAdStoreRow[];
    if (page.length === 0) {
      break;
    }

    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return rows;
}

export async function fetchStructureRowsByIds(params: {
  entityType: StructureComparisonEntityType;
  entityIds: string[];
}): Promise<Array<MetaAdSetStoreRow | MetaAdStoreRow>> {
  const { entityType, entityIds } = params;
  if (entityIds.length === 0) {
    return [];
  }

  if (entityType === "ADSET") {
    const { data, error } = await supabase
      .from(ADSETS_TABLE_NAME)
      .select("id,campaign_id,name,status")
      .in("id", entityIds)
      .range(0, entityIds.length - 1);

    if (error) {
      throw new Error(`Supabase: ${error.message}`);
    }

    return (data ?? []) as MetaAdSetStoreRow[];
  }

  const { data, error } = await supabase
    .from(ADS_TABLE_NAME)
    .select("id,adset_id,campaign_id,name,status,creative_name,creative_thumb,demographics")
    .in("id", entityIds)
    .range(0, entityIds.length - 1);

  if (error) {
    throw new Error(`Supabase: ${error.message}`);
  }

  return (data ?? []) as MetaAdStoreRow[];
}

export async function fetchStructureInsightRowsByRange(params: {
  campaignId: string;
  entityType: StructureComparisonEntityType;
  entityIds: string[];
  since: string;
  until: string;
}): Promise<MetaCampaignInsightStoreRow[]> {
  const { campaignId, entityType, entityIds, since, until } = params;

  if (entityIds.length === 0) {
    return [];
  }

  const pageSize = 1000;
  const rows: MetaCampaignInsightStoreRow[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from(TABLE_NAME)
      .select(STORE_SELECT_FIELDS)
      .eq("campaign_id", campaignId)
      .gte("date", since)
      .lte("date", until)
      .order("date", { ascending: true });

    query =
      entityType === "ADSET"
        ? query.in("adset_id", entityIds)
        : query.in("ad_id", entityIds);

    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) {
      throw new Error(`Supabase: ${error.message}`);
    }

    const page = (data ?? []) as MetaCampaignInsightStoreRow[];
    if (page.length === 0) {
      break;
    }

    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return rows;
}

function aggregateRowsByDate(rows: MetaCampaignInsightStoreRow[]): MetaCampaignInsightStoreRow[] {
  const grouped = new Map<string, MetaCampaignInsightStoreRow>();

  for (const row of rows) {
    const date = row.date;
    if (!date) {
      continue;
    }

    const existing = grouped.get(date);
    const rowActions = parseMetricMap(row.actions);
    const rowCostPerActionType = parseMetricMap(row.cost_per_action_type);

    if (existing) {
      const mergedActions = mergeMetricMaps(parseMetricMap(existing.actions), rowActions);
      const mergedCostPerActionType = mergeMetricMaps(
        parseMetricMap(existing.cost_per_action_type),
        rowCostPerActionType
      );
      grouped.set(date, {
        ...existing,
        date_stop: row.date_stop ?? existing.date_stop ?? date,
        campaign_name: row.campaign_name ?? existing.campaign_name ?? null,
        objective: row.objective ?? existing.objective ?? null,
        effective_status: row.effective_status ?? existing.effective_status ?? null,
        configured_status: row.configured_status ?? existing.configured_status ?? null,
        delivery_status: row.delivery_status ?? existing.delivery_status ?? null,
        spend: toNumber(existing.spend) + toNumber(row.spend),
        impressions: toNumber(existing.impressions) + toNumber(row.impressions),
        clicks: toNumber(existing.clicks) + toNumber(row.clicks),
        reach: toNumber(existing.reach) + toNumber(row.reach),
        frequency: toNumber(existing.frequency) + toNumber(row.frequency),
        ctr: toNumber(existing.ctr) + toNumber(row.ctr),
        cpc: toNumber(existing.cpc) + toNumber(row.cpc),
        cpm: toNumber(existing.cpm) + toNumber(row.cpm),
        cpp: toNumber(existing.cpp) + toNumber(row.cpp),
        unique_clicks: toNumber(existing.unique_clicks) + toNumber(row.unique_clicks),
        inline_link_clicks:
          toNumber(existing.inline_link_clicks) + toNumber(row.inline_link_clicks),
        outbound_clicks: toNumber(existing.outbound_clicks) + toNumber(row.outbound_clicks),
        conversions: toNumber(existing.conversions) + toNumber(row.conversions),
        purchases: toNumber(existing.purchases) + toNumber(row.purchases),
        leads: toNumber(existing.leads) + toNumber(row.leads),
        link_clicks: toNumber(existing.link_clicks) + toNumber(row.link_clicks),
        post_engagement: toNumber(existing.post_engagement) + toNumber(row.post_engagement),
        cost_per_result: null,
        quality_ranking: row.quality_ranking ?? existing.quality_ranking ?? null,
        engagement_rate_ranking:
          row.engagement_rate_ranking ?? existing.engagement_rate_ranking ?? null,
        conversion_rate_ranking:
          row.conversion_rate_ranking ?? existing.conversion_rate_ranking ?? null,
        actions: mergedActions,
        cost_per_action_type: mergedCostPerActionType,
        updated_at: row.updated_at ?? existing.updated_at ?? existing.created_at ?? null
      });
    } else {
      grouped.set(date, {
        date,
        date_stop: row.date_stop ?? date,
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name,
        objective: row.objective ?? null,
        effective_status: row.effective_status ?? null,
        configured_status: row.configured_status ?? null,
        delivery_status: row.delivery_status ?? null,
        spend: toNumber(row.spend),
        impressions: toNumber(row.impressions),
        clicks: toNumber(row.clicks),
        reach: toNumber(row.reach),
        frequency: toNumber(row.frequency),
        ctr: toNumber(row.ctr),
        cpc: toNumber(row.cpc),
        cpm: toNumber(row.cpm),
        cpp: toNumber(row.cpp),
        unique_clicks: toNumber(row.unique_clicks),
        inline_link_clicks: toNumber(row.inline_link_clicks),
        outbound_clicks: toNumber(row.outbound_clicks),
        conversions: toNumber(row.conversions),
        purchases: toNumber(row.purchases),
        leads: toNumber(row.leads),
        link_clicks: toNumber(row.link_clicks),
        post_engagement: toNumber(row.post_engagement),
        cost_per_result: toNumber(row.cost_per_result),
        quality_ranking: row.quality_ranking ?? null,
        engagement_rate_ranking: row.engagement_rate_ranking ?? null,
        conversion_rate_ranking: row.conversion_rate_ranking ?? null,
        actions: rowActions,
        cost_per_action_type: rowCostPerActionType,
        created_at: row.created_at ?? null
      });
    }
  }

  return [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function toNormalizedInsightRow(row: MetaCampaignInsightStoreRow): NormalizedInsightRow {
  const spend = toNumber(row.spend);
  const impressions = toNumber(row.impressions);
  const clicks = toNumber(row.clicks);
  const purchases = toNumber(row.purchases);
  const leads = toNumber(row.leads);
  const conversionsRaw = toNumber(row.conversions);
  const conversions = conversionsRaw > 0 ? conversionsRaw : purchases + leads;
  const reach = toNumber(row.reach);
  const uniqueClicks = toNumber(row.unique_clicks);
  const inlineLinkClicks = toNumber(row.inline_link_clicks);
  const outboundClicks = toNumber(row.outbound_clicks);
  const linkClicks = toNumber(row.link_clicks);
  const postEngagement = toNumber(row.post_engagement);
  const actions = parseMetricMap(row.actions);
  const costPerActionType = parseMetricMap(row.cost_per_action_type);

  if (linkClicks > 0 && actions.link_click === undefined) {
    actions.link_click = linkClicks;
  }

  if (postEngagement > 0 && actions.post_engagement === undefined) {
    actions.post_engagement = postEngagement;
  }

  if (purchases > 0 && actions.purchase === undefined) {
    actions.purchase = purchases;
  }

  if (leads > 0 && actions.lead === undefined) {
    actions.lead = leads;
  }

  if (inlineLinkClicks > 0 && actions.inline_link_click === undefined) {
    actions.inline_link_click = inlineLinkClicks;
  }

  if (outboundClicks > 0 && actions.outbound_click === undefined) {
    actions.outbound_click = outboundClicks;
  }

  if (actions.link_click === undefined && clicks > 0) {
    actions.link_click = clicks;
  }

  if (actions.post_engagement === undefined && clicks > 0) {
    actions.post_engagement = clicks;
  }

  const ctr = impressions > 0 ? (clicks / impressions) * 100 : toNumber(row.ctr);
  const cpc = clicks > 0 ? spend / clicks : toNumber(row.cpc);
  const frequency =
    toNumber(row.frequency) > 0 ? toNumber(row.frequency) : reach > 0 ? impressions / reach : 0;
  const cpm = toNumber(row.cpm) > 0 ? toNumber(row.cpm) : impressions > 0 ? (spend * 1000) / impressions : 0;
  const cpp = toNumber(row.cpp) > 0 ? toNumber(row.cpp) : reach > 0 ? (spend * 1000) / reach : 0;

  return {
    dateStart: row.date,
    dateStop: row.date_stop ?? row.date,
    spend,
    impressions,
    clicks,
    ctr,
    cpc,
    reach,
    frequency,
    cpm,
    cpp,
    uniqueClicks,
    inlineLinkClicks,
    outboundClicks,
    conversions,
    purchases,
    leads,
    qualityRanking: row.quality_ranking?.trim() || null,
    engagementRateRanking: row.engagement_rate_ranking?.trim() || null,
    conversionRateRanking: row.conversion_rate_ranking?.trim() || null,
    actions,
    costPerActionType
  };
}

function parseIsoDateTimeToMillis(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getMostRecentCampaignRow(
  rows: MetaCampaignInsightStoreRow[],
  fallbackRow?: MetaCampaignInsightStoreRow | null
): MetaCampaignInsightStoreRow | null {
  if (rows.length === 0 && !fallbackRow) {
    return null;
  }

  const candidates = fallbackRow ? [...rows, fallbackRow] : [...rows];
  candidates.sort((a, b) => {
    const dateComparison = b.date.localeCompare(a.date);
    if (dateComparison !== 0) {
      return dateComparison;
    }

    const updatedComparison = parseIsoDateTimeToMillis(b.updated_at) - parseIsoDateTimeToMillis(a.updated_at);
    if (updatedComparison !== 0) {
      return updatedComparison;
    }

    const createdComparison = parseIsoDateTimeToMillis(b.created_at) - parseIsoDateTimeToMillis(a.created_at);
    if (createdComparison !== 0) {
      return createdComparison;
    }

    return String(b.delivery_status ?? "").localeCompare(String(a.delivery_status ?? ""));
  });

  return candidates[0] ?? null;
}

function shiftIsoDateByDays(isoDate: string, deltaDays: number): string {
  const baseDate = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(baseDate.getTime())) {
    return isoDate;
  }

  baseDate.setUTCDate(baseDate.getUTCDate() + deltaDays);
  return baseDate.toISOString().slice(0, 10);
}

function inferStatusFromRows(
  rows: MetaCampaignInsightStoreRow[],
  rangeUntil: string,
  fallbackLatestRow?: MetaCampaignInsightStoreRow | null
): {
  deliveryStatus: DeliveryStatus;
  lifecycleStatus: CampaignLifecycleStatus;
  deliveryGroup: CampaignDeliveryGroup;
  effectiveStatus: string;
} {
  const latestRow = getMostRecentCampaignRow(rows, fallbackLatestRow);
  const persistedDelivery = String(latestRow?.delivery_status ?? "")
    .trim()
    .toUpperCase();
  const persistedEffective = String(latestRow?.effective_status ?? "")
    .trim()
    .toUpperCase();
  const persistedConfigured = String(latestRow?.configured_status ?? "")
    .trim()
    .toUpperCase();

  const resolveLifecycleStatus = (
    effectiveStatus: string,
    configuredStatus: string,
    deliveryStatus: DeliveryStatus
  ): CampaignLifecycleStatus => {
    if (
      effectiveStatus.includes("ARCHIVED") ||
      configuredStatus.includes("ARCHIVED") ||
      effectiveStatus.includes("DELETED") ||
      configuredStatus.includes("DELETED")
    ) {
      return "ARCHIVED";
    }

    if (
      effectiveStatus.includes("PAUSED") ||
      configuredStatus.includes("PAUSED") ||
      deliveryStatus === "ADSET_DISABLED"
    ) {
      return "PAUSED";
    }

    if (
      effectiveStatus.includes("COMPLETED") ||
      configuredStatus.includes("COMPLETED") ||
      deliveryStatus === "COMPLETED"
    ) {
      return "COMPLETED";
    }

    if (
      (effectiveStatus === "ACTIVE" || configuredStatus === "ACTIVE") &&
      deliveryStatus === "ACTIVE"
    ) {
      return "RUNNING";
    }

    if (deliveryStatus === "ACTIVE") {
      return "RUNNING";
    }

    return "WITHOUT_DELIVERY";
  };

  const resolveDeliveryGroup = (
    effectiveStatus: string,
    configuredStatus: string,
    deliveryStatus: DeliveryStatus
  ): CampaignDeliveryGroup => {
    const statusSignal = `${effectiveStatus} ${configuredStatus}`.toUpperCase();

    if (statusSignal.includes("ARCHIVED") || statusSignal.includes("DELETED")) {
      return "ARCHIVED";
    }

    if (
      statusSignal.includes("DISAPPROVED") ||
      statusSignal.includes("PENDING_BILLING_INFO") ||
      statusSignal.includes("WITH_ERRORS")
    ) {
      return "WITH_ISSUES";
    }

    if (statusSignal.includes("PENDING_REVIEW") || statusSignal.includes("PENDING")) {
      return "PENDING_REVIEW";
    }

    if (
      statusSignal.includes("PAUSED") ||
      statusSignal.includes("CAMPAIGN_PAUSED") ||
      statusSignal.includes("ADSET_PAUSED") ||
      deliveryStatus === "ADSET_DISABLED"
    ) {
      return "PAUSED";
    }

    if (statusSignal.includes("ACTIVE")) {
      return "ACTIVE";
    }

    return "PAUSED";
  };

  if (
    persistedDelivery === "ACTIVE" ||
    persistedDelivery === "COMPLETED" ||
    persistedDelivery === "ADSET_DISABLED" ||
    persistedDelivery === "WITHOUT_DELIVERY"
  ) {
    const lifecycleStatus = resolveLifecycleStatus(
      persistedEffective,
      persistedConfigured,
      persistedDelivery
    );
    const deliveryGroup = resolveDeliveryGroup(
      persistedEffective,
      persistedConfigured,
      persistedDelivery
    );

    return {
      deliveryStatus: persistedDelivery,
      lifecycleStatus,
      deliveryGroup,
      effectiveStatus: persistedEffective || persistedConfigured || persistedDelivery
    };
  }

  const hasActivity = rows.some(
    (row) =>
      toNumber(row.spend) > 0 || toNumber(row.impressions) > 0 || toNumber(row.clicks) > 0
  );

  if (!hasActivity) {
    return {
      deliveryStatus: "WITHOUT_DELIVERY",
      lifecycleStatus: resolveLifecycleStatus(
        persistedEffective,
        persistedConfigured,
        "WITHOUT_DELIVERY"
      ),
      deliveryGroup: resolveDeliveryGroup(
        persistedEffective,
        persistedConfigured,
        "WITHOUT_DELIVERY"
      ),
      effectiveStatus: persistedEffective || persistedConfigured || "UNKNOWN"
    };
  }

  const latestActiveDate = rows.reduce<string>((latest, row) => {
    const active =
      toNumber(row.spend) > 0 || toNumber(row.impressions) > 0 || toNumber(row.clicks) > 0;
    if (!active) {
      return latest;
    }

    return row.date > latest ? row.date : latest;
  }, "");

  if (latestActiveDate >= rangeUntil) {
    const lifecycleStatus = resolveLifecycleStatus(
      persistedEffective,
      persistedConfigured,
      "ACTIVE"
    );
    const deliveryGroup = resolveDeliveryGroup(
      persistedEffective,
      persistedConfigured,
      "ACTIVE"
    );

    return {
      deliveryStatus: "ACTIVE",
      lifecycleStatus,
      deliveryGroup,
      effectiveStatus: persistedEffective || persistedConfigured || "ACTIVE"
    };
  }

  const lifecycleStatus = resolveLifecycleStatus(
    persistedEffective,
    persistedConfigured,
    "COMPLETED"
  );
  const deliveryGroup = resolveDeliveryGroup(
    persistedEffective,
    persistedConfigured,
    "COMPLETED"
  );

  return {
    deliveryStatus: "COMPLETED",
    lifecycleStatus,
    deliveryGroup,
    effectiveStatus: persistedEffective || persistedConfigured || "COMPLETED"
  };
}

function buildMetaCampaignFromRows(
  campaignId: string,
  rows: MetaCampaignInsightStoreRow[],
  rangeUntil: string
): MetaCampaign | null {
  if (!campaignId || rows.length === 0) {
    return null;
  }

  const lastNamedRow = [...rows].reverse().find((row) => Boolean(row.campaign_name?.trim()));
  const campaignName = lastNamedRow?.campaign_name?.trim() ?? "";
  if (!campaignName) {
    return null;
  }

  const objectiveFromStore = [...rows]
    .reverse()
    .find((row) => Boolean(row.objective?.trim()))
    ?.objective?.trim();
  const objective = objectiveFromStore || inferObjectiveFromCampaignName(campaignName);
  const objectiveCategory = inferObjectiveCategory(objective);
  const totals = rows.reduce(
    (acc, row) => ({
      spend: acc.spend + toNumber(row.spend),
      impressions: acc.impressions + toNumber(row.impressions),
      clicks: acc.clicks + toNumber(row.clicks)
    }),
    { spend: 0, impressions: 0, clicks: 0 }
  );
  const status = inferStatusFromRows(rows, rangeUntil);

  return {
    id: campaignId,
    name: campaignName,
    objective,
    objectiveCategory,
    effectiveStatus: status.effectiveStatus,
    verticalTag: extractVerticalTagFromCampaignName(campaignName),
    deliveryStatus: status.deliveryStatus,
    lifecycleStatus: status.lifecycleStatus,
    deliveryGroup: status.deliveryGroup,
    hasActivityInRange: totals.spend > 0 || totals.impressions > 0,
    periodSpend: totals.spend,
    periodImpressions: totals.impressions,
    periodClicks: totals.clicks
  };
}

export async function getCampaignCatalogFromStore(
  rangeDays: RangeDays,
  forceRefresh = false
): Promise<MetaCampaign[]> {
  if (!isValidRangeDays(rangeDays)) {
    throw new Error("Período inválido. Use 7, 14, 28 ou 30 dias.");
  }

  const range = buildDateRange(rangeDays);
  const cacheKey = `${campaignsCatalogCacheKey(rangeDays, range.until)}:supabase`;
  const cached = cache.get<MetaCampaign[]>(cacheKey);

  if (cached && !forceRefresh) {
    return cached;
  }

  const rowsInRange = await fetchRowsByDateRange({
    since: range.since,
    until: range.until
  });
  const statusLookbackSince = shiftIsoDateByDays(range.until, -CAMPAIGN_STATUS_LOOKBACK_DAYS);
  const statusRows = await fetchRowsByDateRange({
    since: statusLookbackSince,
    until: range.until
  });

  const byCampaignInRange = new Map<string, MetaCampaignInsightStoreRow[]>();
  const latestStatusByCampaign = new Map<string, MetaCampaignInsightStoreRow>();

  for (const row of rowsInRange) {
    const campaignId = (row.campaign_id ?? "").trim();
    if (!campaignId) {
      continue;
    }

    const existing = byCampaignInRange.get(campaignId);
    if (existing) {
      existing.push(row);
    } else {
      byCampaignInRange.set(campaignId, [row]);
    }
  }

  for (const row of statusRows) {
    const campaignId = (row.campaign_id ?? "").trim();
    if (!campaignId) {
      continue;
    }

    const currentLatest = latestStatusByCampaign.get(campaignId);
    const nextLatest = getMostRecentCampaignRow(
      currentLatest ? [currentLatest] : [],
      row
    );
    if (nextLatest) {
      latestStatusByCampaign.set(campaignId, nextLatest);
    }
  }

  const campaignIds = new Set<string>([
    ...byCampaignInRange.keys(),
    ...latestStatusByCampaign.keys()
  ]);

  const campaigns = [...campaignIds]
    .map((campaignId) => {
      const campaignRowsInRange = byCampaignInRange.get(campaignId) ?? [];
      const latestStatusRow = latestStatusByCampaign.get(campaignId) ?? null;
      const sourceRows =
        campaignRowsInRange.length > 0
          ? campaignRowsInRange
          : latestStatusRow
            ? [latestStatusRow]
            : [];

      const campaign = buildMetaCampaignFromRows(campaignId, sourceRows, range.until);
      if (!campaign) {
        return null;
      }

      const inferredStatus = inferStatusFromRows(
        campaignRowsInRange,
        range.until,
        latestStatusRow
      );
      const totalsInRange = campaignRowsInRange.reduce(
        (accumulator, row) => ({
          spend: accumulator.spend + toNumber(row.spend),
          impressions: accumulator.impressions + toNumber(row.impressions),
          clicks: accumulator.clicks + toNumber(row.clicks)
        }),
        { spend: 0, impressions: 0, clicks: 0 }
      );

      return {
        ...campaign,
        effectiveStatus: inferredStatus.effectiveStatus,
        deliveryStatus: inferredStatus.deliveryStatus,
        lifecycleStatus: inferredStatus.lifecycleStatus,
        deliveryGroup: inferredStatus.deliveryGroup,
        hasActivityInRange: totalsInRange.spend > 0 || totalsInRange.impressions > 0,
        periodSpend: totalsInRange.spend,
        periodImpressions: totalsInRange.impressions,
        periodClicks: totalsInRange.clicks
      } satisfies MetaCampaign;
    })
    .filter((campaign): campaign is MetaCampaign => campaign !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  cache.set(cacheKey, campaigns, CACHE_TTL_MS);
  return campaigns;
}

export async function getVerticalBudgetSummaryFromStore(params: {
  verticalTag: string;
  forceRefresh?: boolean;
}): Promise<VerticalBudgetSummary> {
  const { verticalTag, forceRefresh = false } = params;
  const monthRange = buildCurrentMonthToCurrentDateRange();
  const monthlyCap = resolveVerticalMonthlyCap(verticalTag);
  const cacheKey = `${verticalBudgetCacheKey(verticalTag, monthRange.until)}:supabase`;
  const cached = cache.get<VerticalBudgetSummary>(cacheKey);

  if (cached && !forceRefresh) {
    return cached;
  }

  const rows = monthRange.hasElapsedDays
    ? await fetchRowsByDateRange({
        since: monthRange.since,
        until: monthRange.dataUntil
      })
    : [];
  const normalizedVertical = normalizeString(verticalTag || FALLBACK_VERTICAL_TAG);
  const spentInMonth = rows.reduce((total, row) => {
    const campaignVertical = normalizeString(
      extractVerticalTagFromCampaignName(row.campaign_name ?? FALLBACK_VERTICAL_TAG)
    );

    if (campaignVertical !== normalizedVertical) {
      return total;
    }

    return total + toNumber(row.spend);
  }, 0);

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
}

export async function getDashboardPayloadFromStore(params: {
  campaignId: string;
  rangeDays: RangeDays;
  forceRefresh?: boolean;
}): Promise<DashboardPayload> {
  const { campaignId, rangeDays, forceRefresh = false } = params;

  if (!isValidRangeDays(rangeDays)) {
    throw new Error("Período inválido. Use 7, 14, 28 ou 30 dias.");
  }

  const range = buildDateRange(rangeDays);
  const cacheKey = `${performanceCacheKey(campaignId, rangeDays, range.until)}:supabase`;
  const cached = cache.get<DashboardPayload>(cacheKey);

  if (cached && !forceRefresh) {
    return cached;
  }

  const [currentRowsRaw, previousRowsRaw, latestRow] = await Promise.all([
    fetchRowsByDateRange({
      campaignId,
      since: range.since,
      until: range.until
    }),
    fetchRowsByDateRange({
      campaignId,
      since: range.previousSince,
      until: range.previousUntil
    }),
    fetchLatestCampaignRow(campaignId)
  ]);

  const currentRows = aggregateRowsByDate(currentRowsRaw).map(toNormalizedInsightRow);
  const previousRows = aggregateRowsByDate(previousRowsRaw).map(toNormalizedInsightRow);

  if (currentRows.length === 0 && previousRows.length === 0 && !latestRow) {
    throw new Error("Campanha não encontrada no histórico do Supabase.");
  }

  const campaignName =
    latestRow?.campaign_name?.trim() ||
    currentRowsRaw[0]?.campaign_name?.trim() ||
    previousRowsRaw[0]?.campaign_name?.trim() ||
    `Campanha ${campaignId}`;
  const objective = latestRow?.objective?.trim() || inferObjectiveFromCampaignName(campaignName);
  const objectiveCategory = inferObjectiveCategory(objective);
  const campaignStatus = inferStatusFromRows(currentRowsRaw, range.until, latestRow);
  const campaignFromRows = buildMetaCampaignFromRows(campaignId, currentRowsRaw, range.until);
  const campaign = campaignFromRows
    ? {
        ...campaignFromRows,
        effectiveStatus: campaignStatus.effectiveStatus,
        deliveryStatus: campaignStatus.deliveryStatus,
        lifecycleStatus: campaignStatus.lifecycleStatus,
        deliveryGroup: campaignStatus.deliveryGroup
      }
    : {
    id: campaignId,
    name: campaignName,
    objective,
    objectiveCategory,
    effectiveStatus: campaignStatus.effectiveStatus,
    verticalTag: extractVerticalTagFromCampaignName(campaignName),
    deliveryStatus: campaignStatus.deliveryStatus,
    lifecycleStatus: campaignStatus.lifecycleStatus,
    deliveryGroup: campaignStatus.deliveryGroup,
    hasActivityInRange: false,
    periodSpend: 0,
    periodImpressions: 0,
    periodClicks: 0
  };

  const currentSnapshot = buildMetricSnapshot(currentRows, objectiveCategory);
  const previousSnapshot = buildMetricSnapshot(previousRows, objectiveCategory);
  const comparison = buildMetricComparison(currentSnapshot, previousSnapshot);
  const chart = buildDailyMetricPoints(currentRows, objectiveCategory);
  const verticalBudget = await getVerticalBudgetSummaryFromStore({
    verticalTag: campaign.verticalTag,
    forceRefresh
  });
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
}

export async function getCampaignAdSetsFromStore(
  campaignId: string,
  forceRefresh = false
): Promise<MetaAdSet[]> {
  const cacheKey = `${adSetsCacheKey(campaignId)}:supabase`;
  const cached = cache.get<MetaAdSet[]>(cacheKey);

  if (cached && !forceRefresh) {
    return cached;
  }

  const rows = await fetchAdSetRowsByCampaignId(campaignId);
  const adSets: MetaAdSet[] = rows.map((row) => {
    const status = String(row.status ?? "").trim().toUpperCase() || "UNKNOWN";
    return {
      id: row.id,
      name: row.name,
      campaignId: row.campaign_id,
      effectiveStatus: status,
      configuredStatus: status
    };
  });

  cache.set(cacheKey, adSets, CACHE_TTL_MS);
  return adSets;
}

export async function getAdSetAdsFromStore(adSetId: string, forceRefresh = false): Promise<MetaAd[]> {
  const cacheKey = `${adsCacheKey(adSetId)}:supabase`;
  const cached = cache.get<MetaAd[]>(cacheKey);

  if (cached && !forceRefresh) {
    return cached;
  }

  const rows = await fetchAdRowsByAdSetId(adSetId);
  const ads: MetaAd[] = rows.map((row) => {
    const status = String(row.status ?? "").trim().toUpperCase() || "UNKNOWN";
    const creativeName =
      String(row.creative_name ?? "").trim() ||
      String(row.name ?? "").trim() ||
      `Criativo ${row.id}`;

    return {
      id: row.id,
      name: row.name,
      campaignId: row.campaign_id,
      adSetId: row.adset_id,
      effectiveStatus: status,
      configuredStatus: status,
      creativeId: row.id,
      creativeName,
      creativePreviewUrl: row.creative_thumb ?? "",
      demographics: (row.demographics as any) ?? {}
    };
  });

  cache.set(cacheKey, ads, CACHE_TTL_MS);
  return ads;
}

function buildMetricSnapshotFromStoreRows(
  rows: MetaCampaignInsightStoreRow[],
  objectiveCategory: ObjectiveCategory
): MetricSnapshot {
  return buildMetricSnapshot(rows.map(toNormalizedInsightRow), objectiveCategory);
}

export async function getStructureComparisonPayloadFromStore(params: {
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
  const cacheKey = `${structureComparisonCacheKey(
    entityType,
    campaignId,
    rangeDays,
    range.until,
    uniqueIds
  )}:supabase`;
  const cached = cache.get<StructureComparisonPayload>(cacheKey);

  if (cached && !forceRefresh) {
    return cached;
  }

  const [latestRow, structureRows, currentRows, previousRows] = await Promise.all([
    fetchLatestCampaignRow(campaignId),
    fetchStructureRowsByIds({
      entityType,
      entityIds: uniqueIds
    }),
    fetchStructureInsightRowsByRange({
      campaignId,
      entityType,
      entityIds: uniqueIds,
      since: range.since,
      until: range.until
    }),
    fetchStructureInsightRowsByRange({
      campaignId,
      entityType,
      entityIds: uniqueIds,
      since: range.previousSince,
      until: range.previousUntil
    })
  ]);

  if (!latestRow?.campaign_name) {
    throw new Error("Campanha não encontrada no histórico do Supabase.");
  }

  const objective =
    latestRow.objective?.trim() || inferObjectiveFromCampaignName(latestRow.campaign_name);
  const objectiveCategory = inferObjectiveCategory(objective);

  const structureIdSet = new Set(
    (structureRows ?? []).map((row) => (row as MetaAdSetStoreRow | MetaAdStoreRow).id)
  );
  const selectedIds = uniqueIds.filter((id) => structureIdSet.has(id));

  if (selectedIds.length !== 2) {
    throw new Error("Seleção inválida para comparação. Recarregue os dados da estrutura.");
  }

  const items: StructureComparisonItem[] = selectedIds.map((entityId) => {
    const currentEntityRows = currentRows.filter((row) =>
      entityType === "ADSET" ? row.adset_id === entityId : row.ad_id === entityId
    );
    const previousEntityRows = previousRows.filter((row) =>
      entityType === "ADSET" ? row.adset_id === entityId : row.ad_id === entityId
    );

    const current = buildMetricSnapshotFromStoreRows(currentEntityRows, objectiveCategory);
    const previous = buildMetricSnapshotFromStoreRows(previousEntityRows, objectiveCategory);
    const comparison = buildMetricComparison(current, previous);

    return {
      id: entityId,
      current,
      previous,
      deltas: comparison.deltas
    };
  });

  const payload: StructureComparisonPayload = {
    entityType,
    range,
    objectiveCategory,
    items,
    generatedAt: new Date().toISOString(),
    isContingencySnapshot: false,
    contingencyReason: undefined
  };

  cache.set(cacheKey, payload, CACHE_TTL_MS);
  return payload;
}
