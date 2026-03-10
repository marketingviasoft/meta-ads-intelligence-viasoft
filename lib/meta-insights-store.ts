import { cache } from "@/lib/cache";
import {
  campaignsCatalogCacheKey,
  performanceCacheKey,
  verticalBudgetCacheKey
} from "@/lib/cache-keys";
import type {
  CampaignLifecycleStatus,
  DashboardPayload,
  DeliveryStatus,
  MetaCampaign,
  NormalizedInsightRow,
  ObjectiveCategory,
  RangeDays,
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
  campaign_id: string;
  campaign_name: string | null;
  spend: number | string | null;
  impressions: number | string | null;
  clicks: number | string | null;
  purchases: number | string | null;
  created_at?: string | null;
};

const TABLE_NAME = "meta_campaign_insights";
const CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_VERTICAL_MONTHLY_CAP = 535;
const META_INVESTMENT_TAX_RATE = 0.1215;
const VIASOFT_TOTAL_MONTHLY_CAP_WITH_TAX = 1000;
const VIASOFT_VERTICAL_MONTHLY_CAP =
  VIASOFT_TOTAL_MONTHLY_CAP_WITH_TAX / (1 + META_INVESTMENT_TAX_RATE);

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
      .select("date,campaign_id,campaign_name,spend,impressions,clicks,purchases,created_at")
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
    .select("date,campaign_id,campaign_name,spend,impressions,clicks,purchases,created_at")
    .eq("campaign_id", campaignId)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase: ${error.message}`);
  }

  return (data as MetaCampaignInsightStoreRow | null) ?? null;
}

function aggregateRowsByDate(rows: MetaCampaignInsightStoreRow[]): MetaCampaignInsightStoreRow[] {
  const grouped = new Map<string, MetaCampaignInsightStoreRow>();

  for (const row of rows) {
    const date = row.date;
    if (!date) {
      continue;
    }

    const existing = grouped.get(date);
    if (existing) {
      grouped.set(date, {
        ...existing,
        spend: toNumber(existing.spend) + toNumber(row.spend),
        impressions: toNumber(existing.impressions) + toNumber(row.impressions),
        clicks: toNumber(existing.clicks) + toNumber(row.clicks),
        purchases: toNumber(existing.purchases) + toNumber(row.purchases)
      });
    } else {
      grouped.set(date, {
        date,
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name,
        spend: toNumber(row.spend),
        impressions: toNumber(row.impressions),
        clicks: toNumber(row.clicks),
        purchases: toNumber(row.purchases),
        created_at: row.created_at ?? null
      });
    }
  }

  return [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function toNormalizedInsightRow(row: MetaCampaignInsightStoreRow): NormalizedInsightRow {
  const spend = toNumber(row.spend);
  const impressions = toNumber(row.impressions);
  const clicks = toNumber(row.clicks);
  const purchases = toNumber(row.purchases);

  return {
    dateStart: row.date,
    dateStop: row.date,
    spend,
    impressions,
    clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    conversions: purchases,
    actions: {
      // Fallbacks para manter a engine existente sem quebrar quando a origem é o warehouse.
      link_click: clicks,
      post_engagement: clicks,
      purchase: purchases,
      lead: purchases
    },
    costPerActionType: {}
  };
}

function inferStatusFromRows(rows: MetaCampaignInsightStoreRow[], rangeUntil: string): {
  deliveryStatus: DeliveryStatus;
  lifecycleStatus: CampaignLifecycleStatus;
  effectiveStatus: string;
} {
  const hasActivity = rows.some(
    (row) =>
      toNumber(row.spend) > 0 || toNumber(row.impressions) > 0 || toNumber(row.clicks) > 0
  );

  if (!hasActivity) {
    return {
      deliveryStatus: "WITHOUT_DELIVERY",
      lifecycleStatus: "WITHOUT_DELIVERY",
      effectiveStatus: "UNKNOWN"
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
    return {
      deliveryStatus: "ACTIVE",
      lifecycleStatus: "RUNNING",
      effectiveStatus: "ACTIVE"
    };
  }

  return {
    deliveryStatus: "COMPLETED",
    lifecycleStatus: "COMPLETED",
    effectiveStatus: "COMPLETED"
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

  const objective = inferObjectiveFromCampaignName(campaignName);
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

  const rows = await fetchRowsByDateRange({
    since: range.since,
    until: range.until
  });

  const byCampaign = new Map<string, MetaCampaignInsightStoreRow[]>();

  for (const row of rows) {
    const campaignId = (row.campaign_id ?? "").trim();
    if (!campaignId) {
      continue;
    }

    const existing = byCampaign.get(campaignId);
    if (existing) {
      existing.push(row);
    } else {
      byCampaign.set(campaignId, [row]);
    }
  }

  const campaigns = [...byCampaign.entries()]
    .map(([campaignId, campaignRows]) => buildMetaCampaignFromRows(campaignId, campaignRows, range.until))
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
  const objective = inferObjectiveFromCampaignName(campaignName);
  const objectiveCategory = inferObjectiveCategory(objective);
  const campaignStatus = inferStatusFromRows(currentRowsRaw, range.until);
  const campaign = buildMetaCampaignFromRows(campaignId, currentRowsRaw, range.until) ?? {
    id: campaignId,
    name: campaignName,
    objective,
    objectiveCategory,
    effectiveStatus: campaignStatus.effectiveStatus,
    verticalTag: extractVerticalTagFromCampaignName(campaignName),
    deliveryStatus: campaignStatus.deliveryStatus,
    lifecycleStatus: campaignStatus.lifecycleStatus,
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
