export const ALLOWED_RANGE_DAYS = [7, 14, 28, 30] as const;

export type RangeDays = (typeof ALLOWED_RANGE_DAYS)[number];

export type ObjectiveCategory = "TRAFFIC" | "ENGAGEMENT" | "RECOGNITION" | "CONVERSIONS";
export type DeliveryStatus =
  | "ACTIVE"
  | "COMPLETED"
  | "ADSET_DISABLED"
  | "WITHOUT_DELIVERY";
export type CampaignLifecycleStatus =
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "WITHOUT_DELIVERY"
  | "ARCHIVED";
export type CampaignDeliveryGroup =
  | "ACTIVE"
  | "PAUSED"
  | "WITH_ISSUES"
  | "PENDING_REVIEW"
  | "ARCHIVED";

export type InsightSeverity = "alert" | "opportunity" | "info";

export interface MetaCampaign {
  id: string;
  name: string;
  objective: string;
  objectiveCategory: ObjectiveCategory;
  effectiveStatus: string;
  verticalTag: string;
  deliveryStatus: DeliveryStatus;
  lifecycleStatus: CampaignLifecycleStatus;
  deliveryGroup: CampaignDeliveryGroup;
  hasActivityInRange: boolean;
  periodSpend: number;
  periodImpressions: number;
  periodClicks: number;
}

export interface MetaAdSet {
  id: string;
  name: string;
  campaignId: string;
  effectiveStatus: string;
  configuredStatus: string;
  objectiveCategory?: ObjectiveCategory;
  metrics?: MetricSnapshot;
  previousMetrics?: MetricSnapshot;
  deltas?: MetricComparison["deltas"];
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
  demographics?: {
    age: Record<string, number>;
    gender: Record<string, number>;
  };
}

export interface MetaAdPreview {
  adId: string;
  adFormat: string;
  iframeUrl: string;
  renderWidth?: number;
  renderHeight?: number;
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
  reach: number;
  frequency: number;
  cpm: number;
  cpp: number;
  uniqueClicks: number;
  inlineLinkClicks: number;
  outboundClicks: number;
  conversions: number;
  purchases: number;
  leads: number;
  qualityRanking: string | null;
  engagementRateRanking: string | null;
  conversionRateRanking: string | null;
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

export interface VideoMetrics {
  plays: number;
  avgPlayTime: number;
  partialViewRate: number; // 25% or similar
  fullViewRate: number;    // ThruPlays
}

export interface DemographicBreakdown {
  label: string;
  value: number;
  percent: number;
}

export interface AdAnalytics {
  general: MetricSnapshot;
  video?: VideoMetrics;
  demographics: {
    age: DemographicBreakdown[];
    gender: DemographicBreakdown[];
  };
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

export type StructureComparisonEntityType = "ADSET" | "AD";

export interface StructureComparisonItem {
  id: string;
  current: MetricSnapshot;
  previous: MetricSnapshot;
  deltas: MetricComparison["deltas"];
}

export interface StructureComparisonPayload {
  entityType: StructureComparisonEntityType;
  range: DateRangeSelection;
  objectiveCategory: ObjectiveCategory;
  items: StructureComparisonItem[];
  generatedAt: string;
  isContingencySnapshot?: boolean;
  contingencyReason?: string;
  retryAfterSeconds?: number;
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

export interface VerticalBudgetSummary {
  verticalTag: string;
  monthlyCap: number;
  monthSince: string;
  monthUntil: string;
  dataUntil: string;
  spentInMonth: number;
  remainingInMonth: number;
  overBudgetAmount: number;
  utilizationPercent: number;
  hasElapsedDays: boolean;
  includesCurrentDay: boolean;
  timezone: string;
}

export interface DashboardPayload {
  campaign: MetaCampaign;
  range: DateRangeSelection;
  comparison: MetricComparison;
  verticalBudget: VerticalBudgetSummary;
  chart: DailyMetricPoint[];
  insights: InsightMessage[];
  recommendations: Recommendation[];
  generatedAt: string;
}

export interface ExecutiveGlobalMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  results: number;
  costPerResult: number | null;
  roas: number | null;
}

export interface ExecutiveMetricDeltas {
  spend: MetricDelta;
  impressions: MetricDelta;
  clicks: MetricDelta;
  ctr: MetricDelta;
  cpc: MetricDelta;
  results: MetricDelta;
  costPerResult: MetricDelta;
  roas: MetricDelta;
}

export interface ExecutiveMetricComparison {
  current: ExecutiveGlobalMetrics;
  previous: ExecutiveGlobalMetrics;
  deltas: ExecutiveMetricDeltas;
  trend: TrendSummary;
}

export interface DashboardCampaignSummary {
  campaign: MetaCampaign;
  metrics: MetricSnapshot;
  roas: number | null;
}

export interface ExecutivePayload {
  range: DateRangeSelection;
  globalMetrics: ExecutiveGlobalMetrics;
  comparison: ExecutiveMetricComparison;
  chart: DailyMetricPoint[];
  campaigns: DashboardCampaignSummary[];
  objectiveDistribution: { 
    objectiveCategory: ObjectiveCategory; 
    spend: number; 
    results: number; 
    percent: number;
    resultsPercent: number | null;
  }[];
  statusDistribution: {
    deliveryGroup: string;
    spend: number;
    results: number;
    percent: number;
    resultsPercent: number | null;
  }[];
  verticalDistribution: {
    verticalTag: string;
    spend: number;
    results: number;
    percent: number;
    resultsPercent: number | null;
  }[];
  insights: InsightMessage[];
  generatedAt: string;
}
