import type {
  DailyMetricPoint,
  MetricComparison,
  MetricDelta,
  MetricSnapshot,
  NormalizedInsightRow,
  ObjectiveCategory,
  TrendSummary
} from "@/lib/types";
import { sumBy } from "@/utils/numbers";
import { getPrimaryMetricDefinition } from "@/utils/objective";

const CONVERSION_ACTION_HINTS = [
  "purchase",
  "lead",
  "complete_registration",
  "offsite_conversion",
  "onsite_conversion",
  "subscribe",
  "contact",
  "donate"
];

function readActionMetric(row: NormalizedInsightRow, actionType: string): number {
  return row.actions[actionType] ?? 0;
}

function readConversionFallback(row: NormalizedInsightRow): number {
  return Object.entries(row.actions).reduce((total, [actionType, value]) => {
    const lowerActionType = actionType.toLowerCase();
    const match = CONVERSION_ACTION_HINTS.some((hint) => lowerActionType.includes(hint));
    return match ? total + value : total;
  }, 0);
}

export function resolveResultByObjective(
  row: NormalizedInsightRow,
  category: ObjectiveCategory
): number {
  switch (category) {
    case "TRAFFIC":
      return readActionMetric(row, "link_click");
    case "ENGAGEMENT":
      return readActionMetric(row, "post_engagement");
    case "RECOGNITION":
      return row.impressions;
    case "CONVERSIONS":
      if (row.conversions > 0) {
        return row.conversions;
      }
      return readConversionFallback(row);
    default:
      return row.conversions;
  }
}

export function buildMetricSnapshot(
  rows: NormalizedInsightRow[],
  category: ObjectiveCategory
): MetricSnapshot {
  const spend = sumBy(rows, (row) => row.spend);
  const impressions = sumBy(rows, (row) => row.impressions);
  const clicks = sumBy(rows, (row) => row.clicks);
  const results = sumBy(rows, (row) => resolveResultByObjective(row, category));

  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpc = clicks > 0 ? spend / clicks : 0;
  const costPerResult = results > 0 ? spend / results : null;

  const primaryMetric = getPrimaryMetricDefinition(category);

  return {
    spend,
    impressions,
    clicks,
    ctr,
    cpc,
    results,
    costPerResult,
    primaryMetricKey: primaryMetric.key,
    primaryMetricLabel: primaryMetric.label
  };
}

export function buildDailyMetricPoints(
  rows: NormalizedInsightRow[],
  category: ObjectiveCategory
): DailyMetricPoint[] {
  return [...rows]
    .sort((a, b) => a.dateStart.localeCompare(b.dateStart))
    .map((row) => {
      const results = resolveResultByObjective(row, category);
      const ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
      const cpc = row.clicks > 0 ? row.spend / row.clicks : 0;

      return {
        date: row.dateStart,
        spend: row.spend,
        impressions: row.impressions,
        clicks: row.clicks,
        ctr,
        cpc,
        results,
        costPerResult: results > 0 ? row.spend / results : null
      };
    });
}

function calculateDelta(currentValue: number | null, previousValue: number | null): MetricDelta {
  if (currentValue === null && previousValue === null) {
    return {
      absolute: 0,
      percent: null
    };
  }

  const current = currentValue ?? 0;
  const previous = previousValue ?? 0;
  const absolute = current - previous;

  if (previous === 0) {
    return {
      absolute,
      percent: null
    };
  }

  return {
    absolute,
    percent: (absolute / previous) * 100
  };
}

function computeTrend(comparison: Omit<MetricComparison, "trend">): TrendSummary {
  let score = 0;

  const resultChange = comparison.deltas.results.percent ?? 0;
  const ctrChange = comparison.deltas.ctr.percent ?? 0;
  const cpcChange = comparison.deltas.cpc.percent ?? 0;
  const costPerResultChange = comparison.deltas.costPerResult.percent ?? 0;

  if (resultChange >= 5) {
    score += 2;
  } else if (resultChange <= -5) {
    score -= 2;
  }

  if (ctrChange >= 3) {
    score += 1;
  } else if (ctrChange <= -3) {
    score -= 1;
  }

  if (cpcChange <= -3) {
    score += 1;
  } else if (cpcChange >= 3) {
    score -= 1;
  }

  if (costPerResultChange !== 0) {
    if (costPerResultChange <= -3) {
      score += 1;
    } else if (costPerResultChange >= 3) {
      score -= 1;
    }
  }

  if (score >= 2) {
    return {
      direction: "positive",
      score,
      message: "Crescimento consistente no período comparativo, com eficiência operacional preservada."
    };
  }

  if (score <= -2) {
    return {
      direction: "negative",
      score,
      message: "Redução relevante no desempenho comparativo, com pressão de custos."
    };
  }

  return {
    direction: "neutral",
    score,
    message: "Estabilidade no período comparativo, sem variações estruturais relevantes."
  };
}

export function buildMetricComparison(
  current: MetricSnapshot,
  previous: MetricSnapshot
): MetricComparison {
  const partial: Omit<MetricComparison, "trend"> = {
    current,
    previous,
    deltas: {
      spend: calculateDelta(current.spend, previous.spend),
      impressions: calculateDelta(current.impressions, previous.impressions),
      clicks: calculateDelta(current.clicks, previous.clicks),
      ctr: calculateDelta(current.ctr, previous.ctr),
      cpc: calculateDelta(current.cpc, previous.cpc),
      results: calculateDelta(current.results, previous.results),
      costPerResult: calculateDelta(current.costPerResult, previous.costPerResult)
    }
  };

  return {
    ...partial,
    trend: computeTrend(partial)
  };
}
