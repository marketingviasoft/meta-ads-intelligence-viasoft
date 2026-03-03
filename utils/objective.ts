import type { ObjectiveCategory } from "@/lib/types";

const TRAFFIC_OBJECTIVES = new Set([
  "TRAFFIC",
  "LINK_CLICKS",
  "OUTCOME_TRAFFIC"
]);

const ENGAGEMENT_OBJECTIVES = new Set([
  "ENGAGEMENT",
  "POST_ENGAGEMENT",
  "PAGE_LIKES",
  "EVENT_RESPONSES",
  "OUTCOME_ENGAGEMENT"
]);

const RECOGNITION_OBJECTIVES = new Set([
  "AWARENESS",
  "REACH",
  "BRAND_AWARENESS",
  "OUTCOME_AWARENESS"
]);

const CONVERSION_OBJECTIVES = new Set([
  "CONVERSIONS",
  "LEAD_GENERATION",
  "OUTCOME_LEADS",
  "OUTCOME_SALES",
  "SALES",
  "CATALOG_SALES",
  "APP_PROMOTION"
]);

export function getObjectiveCategory(rawObjective: string): ObjectiveCategory {
  const objective = rawObjective?.toUpperCase?.() ?? "";

  if (TRAFFIC_OBJECTIVES.has(objective)) {
    return "TRAFFIC";
  }

  if (ENGAGEMENT_OBJECTIVES.has(objective)) {
    return "ENGAGEMENT";
  }

  if (RECOGNITION_OBJECTIVES.has(objective)) {
    return "RECOGNITION";
  }

  if (CONVERSION_OBJECTIVES.has(objective)) {
    return "CONVERSIONS";
  }

  return "CONVERSIONS";
}

export function getPrimaryMetricDefinition(category: ObjectiveCategory): {
  key: string;
  label: string;
} {
  switch (category) {
    case "TRAFFIC":
      return {
        key: "link_clicks",
        label: "Cliques no link"
      };
    case "ENGAGEMENT":
      return {
        key: "post_engagement",
        label: "Engajamento"
      };
    case "RECOGNITION":
      return {
        key: "impressions",
        label: "Impressoes"
      };
    case "CONVERSIONS":
      return {
        key: "conversions",
        label: "Conversoes"
      };
    default:
      return {
        key: "conversions",
        label: "Conversoes"
      };
  }
}