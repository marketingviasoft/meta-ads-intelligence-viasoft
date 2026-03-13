import {
  fetchAdBreakdowns,
  fetchAdInsights,
  fetchCampaignById
} from "@/services/meta-api";
import { buildDateRange, isValidRangeDays } from "@/utils/date-range";
import { buildMetricSnapshot } from "@/utils/metrics";
import { toNumber } from "@/utils/numbers";
import {
  fetchStructureRowsByIds,
  fetchStructureInsightRowsByRange,
  toNormalizedInsightRow
} from "./meta-insights-store";
import type {
  AdAnalytics,
  DemographicBreakdown,
  NormalizedInsightRow,
  RangeDays,
  VideoMetrics,
  MetaAd
} from "./types";

export async function getAdAnalytics(params: {
  adId: string;
  campaignId: string;
  rangeDays: RangeDays;
}): Promise<AdAnalytics> {
  const { adId, campaignId, rangeDays } = params;

  if (!isValidRangeDays(rangeDays)) {
    throw new Error("Período inválido.");
  }

  const range = buildDateRange(rangeDays);

  // 1. Try to fetch from Store first
  try {
    const [adRows, insightRows] = await Promise.all([
      fetchStructureRowsByIds({ entityType: "AD", entityIds: [adId] }),
      fetchStructureInsightRowsByRange({
        campaignId,
        entityType: "AD",
        entityIds: [adId],
        since: range.since,
        until: range.until
      })
    ]);

    const ad = adRows[0] as MetaAd | undefined;
    
    // If we have insights in the store, prefer this data (faster)
    if (insightRows.length > 0) {
      const normalizedRows = insightRows.map(toNormalizedInsightRow);
      const campaign = await fetchCampaignById(campaignId); // Still need campaign for objective category

      if (campaign) {
        const general = buildMetricSnapshot(normalizedRows, campaign.objectiveCategory);
        const video = processVideoMetrics(normalizedRows);
        
        // Use synced demographics if available, otherwise empty
        const syncedDemographics = ad?.demographics || { age: {}, gender: {} };
        const demographics = {
          age: processBreakdownMap(syncedDemographics.age, "age"),
          gender: processBreakdownMap(syncedDemographics.gender, "gender")
        };

        return {
          general,
          video,
          demographics
        };
      }
    }
  } catch (error) {
    console.warn("Falha ao buscar dados do store para analytics, tentando Live API...", error);
  }

  // 2. Fallback to Live API
  const [campaign, adInsights, ageRows, genderRows] = await Promise.all([
    fetchCampaignById(campaignId),
    fetchAdInsights({
      adId,
      since: range.since,
      until: range.until
    }),
    fetchAdBreakdowns({
      adId,
      since: range.since,
      until: range.until,
      breakdowns: ["age"]
    }),
    fetchAdBreakdowns({
      adId,
      since: range.since,
      until: range.until,
      breakdowns: ["gender"]
    })
  ]);

  if (!campaign) {
    throw new Error("Campanha não encontrada.");
  }

  const general = buildMetricSnapshot(adInsights, campaign.objectiveCategory);
  const video = processVideoMetrics(adInsights);
  const demographics = {
    age: processBreakdownRows(ageRows, "age"),
    gender: processBreakdownRows(genderRows, "gender")
  };

  return {
    general,
    video,
    demographics
  };
}

function processBreakdownMap(
  map: Record<string, number> | undefined,
  key: string
): DemographicBreakdown[] {
  if (!map || Object.keys(map).length === 0) return [];

  const totalValue = Object.values(map).reduce((sum, val) => sum + val, 0);
  return Object.entries(map)
    .map(([label, value]) => ({
      label,
      value,
      percent: totalValue > 0 ? (value / totalValue) * 100 : 0
    }))
    .sort((a, b) => b.value - a.value);
}

function processVideoMetrics(rows: NormalizedInsightRow[]): VideoMetrics | undefined {
  if (rows.length === 0) return undefined;

  const aggregated = rows.reduce(
    (acc, row) => {
      acc.plays += row.actions.video_play ?? 0;
      acc.p25 += row.actions.video_p25_watched ?? 0;
      acc.p100 += row.actions.video_p100_watched ?? 0;
      acc.thruplay += row.actions.video_thruplay_watched ?? 0;
      acc.sumAvgTime += row.actions.video_avg_time_watched ?? 0;
      return acc;
    },
    { plays: 0, p25: 0, p100: 0, thruplay: 0, sumAvgTime: 0 }
  );

  if (aggregated.plays === 0) return undefined;

  return {
    plays: aggregated.plays,
    avgPlayTime: aggregated.sumAvgTime / rows.length, // Rough average
    partialViewRate: (aggregated.p25 / aggregated.plays) * 100,
    fullViewRate: (aggregated.thruplay / aggregated.plays) * 100
  };
}

function processBreakdownRows(
  rows: NormalizedInsightRow[],
  key: string
): DemographicBreakdown[] {
  const totalSpend = rows.reduce((sum, row) => sum + row.spend, 0);
  const map = new Map<string, number>();

  for (const row of rows) {
    const label = Reflect.get(row, key) as string;
    if (!label) continue;
    map.set(label, (map.get(label) ?? 0) + row.spend);
  }

  return Array.from(map.entries())
    .map(([label, value]) => ({
      label,
      value,
      percent: totalSpend > 0 ? (value / totalSpend) * 100 : 0
    }))
    .sort((a, b) => b.value - a.value);
}
