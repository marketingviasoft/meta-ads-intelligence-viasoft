import type { CampaignDeliveryGroup, RangeDays } from "@/lib/types";
import { ALLOWED_RANGE_DAYS } from "@/lib/types";
import { resolveSupportedVertical } from "@/lib/verticals";

export const DASHBOARD_QUERY_KEYS = {
  verticalTag: "verticalTag",
  deliveryGroup: "deliveryGroup",
  rangeDays: "rangeDays",
  campaignId: "campaignId"
} as const;

export const ALL_VERTICALS_VALUE = "__ALL_VERTICALS__" as const;
export const CAMPAIGN_STATUS_FILTER_ALL = "ALL" as const;

export type CampaignStatusFilterValue =
  | typeof CAMPAIGN_STATUS_FILTER_ALL
  | CampaignDeliveryGroup;

export const DELIVERY_STATUS_FILTERS: Array<{
  value: CampaignStatusFilterValue;
  label: string;
}> = [
  { value: CAMPAIGN_STATUS_FILTER_ALL, label: "Todos os status" },
  { value: "ACTIVE", label: "Ativas" },
  { value: "PAUSED", label: "Pausadas" },
  { value: "WITH_ISSUES", label: "Com problemas" },
  { value: "PENDING_REVIEW", label: "Em análise" },
  { value: "ARCHIVED", label: "Arquivadas" }
];

export type DashboardSearchParams = Record<string, string | string[] | undefined>;

export type DashboardInitialState = {
  initialVerticalTag: string | null;
  initialDeliveryGroup: CampaignStatusFilterValue;
  initialRangeDays: RangeDays;
  initialCampaignId: string | null;
};

const SUPPORTED_DELIVERY_GROUPS = new Set<CampaignStatusFilterValue>(
  DELIVERY_STATUS_FILTERS.map((item) => item.value)
);

export function getFirstQueryValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const trimmed = entry.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  return null;
}

export function normalizeRangeDays(value: string | null): RangeDays {
  const parsed = Number.parseInt(value ?? "", 10);

  if (ALLOWED_RANGE_DAYS.includes(parsed as RangeDays)) {
    return parsed as RangeDays;
  }

  return 7;
}

export function normalizeVerticalTag(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return resolveSupportedVertical(value);
}

export function normalizeDeliveryGroup(value: string | null): CampaignStatusFilterValue {
  if (!value) {
    return CAMPAIGN_STATUS_FILTER_ALL;
  }

  return SUPPORTED_DELIVERY_GROUPS.has(value as CampaignStatusFilterValue)
    ? (value as CampaignStatusFilterValue)
    : CAMPAIGN_STATUS_FILTER_ALL;
}

export function normalizeCampaignId(value: string | null): string | null {
  return value ? value.trim() : null;
}

export function getDashboardInitialState(
  searchParams: DashboardSearchParams | URLSearchParams
): DashboardInitialState {
  const params =
    searchParams instanceof URLSearchParams
      ? Object.fromEntries(searchParams.entries())
      : searchParams;

  return {
    initialVerticalTag: normalizeVerticalTag(
      getFirstQueryValue(params[DASHBOARD_QUERY_KEYS.verticalTag])
    ),
    initialDeliveryGroup: normalizeDeliveryGroup(
      getFirstQueryValue(params[DASHBOARD_QUERY_KEYS.deliveryGroup])
    ),
    initialRangeDays: normalizeRangeDays(
      getFirstQueryValue(params[DASHBOARD_QUERY_KEYS.rangeDays])
    ),
    initialCampaignId: normalizeCampaignId(
      getFirstQueryValue(params[DASHBOARD_QUERY_KEYS.campaignId])
    )
  };
}

type DashboardHrefOptions = {
  pathname: string;
  verticalTag?: string | null;
  deliveryGroup?: CampaignStatusFilterValue | null;
  rangeDays?: RangeDays | null;
  campaignId?: string | null;
  includeCampaignId?: boolean;
};

export function buildDashboardHref({
  pathname,
  verticalTag,
  deliveryGroup,
  rangeDays,
  campaignId,
  includeCampaignId = false
}: DashboardHrefOptions): string {
  const params = new URLSearchParams();

  if (verticalTag) {
    params.set(DASHBOARD_QUERY_KEYS.verticalTag, verticalTag);
  }

  if (deliveryGroup && deliveryGroup !== CAMPAIGN_STATUS_FILTER_ALL) {
    params.set(DASHBOARD_QUERY_KEYS.deliveryGroup, deliveryGroup);
  }

  if (rangeDays) {
    params.set(DASHBOARD_QUERY_KEYS.rangeDays, String(rangeDays));
  }

  if (includeCampaignId && campaignId) {
    params.set(DASHBOARD_QUERY_KEYS.campaignId, campaignId);
  }

  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}
