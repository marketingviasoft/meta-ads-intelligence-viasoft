export const ALLOWED_RANGE_DAYS = [7, 14, 28, 30] as const;

export type RangeDays = (typeof ALLOWED_RANGE_DAYS)[number];

export type ObjectiveCategory = "TRAFFIC" | "ENGAGEMENT" | "RECOGNITION" | "CONVERSIONS";
export type DeliveryStatus =
  | "ACTIVE"
  | "COMPLETED"
  | "ADSET_DISABLED"
  | "WITHOUT_DELIVERY";

export type InsightSeverity = "alert" | "opportunity" | "info";

export interface MetaCampaign {
  id: string;
  name: string;
  objective: string;
  objectiveCategory: ObjectiveCategory;
  effectiveStatus: string;
  verticalTag: string;
  deliveryStatus: DeliveryStatus;
}

export interface MetaAdSet {
  id: string;
  name: string;
  campaignId: string;
  effectiveStatus: string;
  configuredStatus: string;
}

export interface MetaAd {
  id: string;
  name: string;
  campaignId: string;
  adSetId: string;
  effectiveStatus: string;
  configuredStatus: string;
  creativeId: string;
  creativeName: string;
  creativePreviewUrl: string;
  destinationUrl: string;
}

export interface MetaAdPreview {
  adId: string;
  adFormat: string;
  iframeUrl: string;
}

export interface DateRangeSelection {
  days: RangeDays;
  since: string;
  until: string;
  previousSince: string;
  previousUntil: string;
}

export interface NormalizedInsightRow {
  dateStart: string;
  dateStop: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  actions: Record<string, number>;
  costPerActionType: Record<string, number>;
}

export interface MetricSnapshot {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  results: number;
  costPerResult: number | null;
  primaryMetricKey: string;
  primaryMetricLabel: string;
}

export interface MetricDelta {
  absolute: number;
  percent: number | null;
}

export interface TrendSummary {
  direction: "positive" | "negative" | "neutral";
  score: number;
  message: string;
}

export interface MetricComparison {
  current: MetricSnapshot;
  previous: MetricSnapshot;
  deltas: {
    spend: MetricDelta;
    impressions: MetricDelta;
    clicks: MetricDelta;
    ctr: MetricDelta;
    cpc: MetricDelta;
    results: MetricDelta;
    costPerResult: MetricDelta;
  };
  trend: TrendSummary;
}

export interface DailyMetricPoint {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  results: number;
  costPerResult: number | null;
}

export interface InsightMessage {
  type: InsightSeverity;
  title: string;
  message: string;
}

export interface Recommendation {
  title: string;
  message: string;
}

export interface DashboardPayload {
  campaign: MetaCampaign;
  range: DateRangeSelection;
  comparison: MetricComparison;
  chart: DailyMetricPoint[];
  insights: InsightMessage[];
  recommendations: Recommendation[];
  generatedAt: string;
}
