import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabaseClient.js", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      range: vi.fn().mockResolvedValue({ data: [], error: null })
    }))
  }
}));

vi.mock("@/lib/cache", () => ({
  cache: {
    get: vi.fn().mockReturnValue(null),
    set: vi.fn()
  }
}));

vi.mock("@/utils/date-range", () => ({
  buildDateRange: vi.fn(() => ({
    since: "2026-03-05",
    until: "2026-04-01",
    previousSince: "2026-02-06",
    previousUntil: "2026-03-04"
  })),
  isValidRangeDays: vi.fn(() => true)
}));

import {
  buildDashboardHref,
  getDashboardInitialState
} from "@/lib/dashboard-query";
import { getExecutivePayloadFromStore } from "@/lib/meta-insights-store";
import { supabase } from "@/lib/supabaseClient.js";

type MockableFrom = {
  mockImplementation: (implementation: (table: string) => unknown) => unknown;
};

const currentRows = [
  {
    date: "2026-03-30",
    campaign_id: "camp-1",
    campaign_name: "[META] [VIASOFT] [CONVERSAO] Campanha A",
    objective: "OUTCOME_SALES",
    effective_status: "ACTIVE",
    configured_status: "ACTIVE",
    delivery_status: "ACTIVE",
    spend: "100",
    impressions: "1000",
    clicks: "50",
    conversions: "10",
    purchases: "0",
    leads: "0"
  },
  {
    date: "2026-03-30",
    campaign_id: "camp-2",
    campaign_name: "[META] [VOORS] [TRAFEGO] Campanha B",
    objective: "OUTCOME_TRAFFIC",
    effective_status: "PAUSED",
    configured_status: "PAUSED",
    delivery_status: "ADSET_DISABLED",
    spend: "40",
    impressions: "400",
    clicks: "20",
    conversions: "0",
    purchases: "0",
    leads: "0"
  },
  {
    date: "2026-03-31",
    campaign_id: "camp-3",
    campaign_name: "[META] [VIASOFT] [ENGAJAMENTO] Campanha C",
    objective: "POST_ENGAGEMENT",
    effective_status: "ACTIVE",
    configured_status: "ACTIVE",
    delivery_status: "ACTIVE",
    spend: "60",
    impressions: "600",
    clicks: "12",
    conversions: "0",
    purchases: "0",
    leads: "0"
  }
];

const previousRows = [
  {
    date: "2026-03-01",
    campaign_id: "camp-1",
    campaign_name: "[META] [VIASOFT] [CONVERSAO] Campanha A",
    objective: "OUTCOME_SALES",
    effective_status: "ACTIVE",
    configured_status: "ACTIVE",
    delivery_status: "ACTIVE",
    spend: "50",
    impressions: "500",
    clicks: "25",
    conversions: "5",
    purchases: "0",
    leads: "0"
  },
  {
    date: "2026-03-01",
    campaign_id: "camp-2",
    campaign_name: "[META] [VOORS] [TRAFEGO] Campanha B",
    objective: "OUTCOME_TRAFFIC",
    effective_status: "PAUSED",
    configured_status: "PAUSED",
    delivery_status: "ADSET_DISABLED",
    spend: "20",
    impressions: "200",
    clicks: "10",
    conversions: "0",
    purchases: "0",
    leads: "0"
  },
  {
    date: "2026-03-02",
    campaign_id: "camp-3",
    campaign_name: "[META] [VIASOFT] [ENGAJAMENTO] Campanha C",
    objective: "POST_ENGAGEMENT",
    effective_status: "ACTIVE",
    configured_status: "ACTIVE",
    delivery_status: "ACTIVE",
    spend: "30",
    impressions: "300",
    clicks: "6",
    conversions: "0",
    purchases: "0",
    leads: "0"
  }
];

function resolveRows(since: string, until: string, callCount: number) {
  if (callCount > 1) {
    return [];
  }

  if (since === "2026-03-05" && until === "2026-04-01") {
    return currentRows;
  }

  if (since === "2026-02-06" && until === "2026-03-04") {
    return previousRows;
  }

  if (until === "2026-04-01") {
    return currentRows;
  }

  return [];
}

describe("Executive dashboard payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockedFrom = supabase.from as unknown as MockableFrom;
    mockedFrom.mockImplementation((table: string) => {
      expect(table).toBe("meta_campaign_insights");

      let since = "";
      let until = "";
      let rangeCallCount = 0;

      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn((field: string, value: string) => {
          if (field === "date") {
            since = value;
          }
          return chain;
        }),
        lte: vi.fn((field: string, value: string) => {
          if (field === "date") {
            until = value;
          }
          return chain;
        }),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        range: vi.fn(async () => {
          rangeCallCount += 1;
          return {
            data: resolveRows(since, until, rangeCallCount),
            error: null
          };
        })
      };

      return chain;
    });
  });

  it("calculates objective, status and vertical distributions for the executive view", async () => {
    const payload = await getExecutivePayloadFromStore({
      verticalTag: null,
      deliveryGroup: "ALL",
      rangeDays: 28
    });

    expect(payload.campaigns).toHaveLength(3);
    expect(payload.globalMetrics.spend).toBe(200);
    expect(payload.globalMetrics.results).toBe(42);
    expect(payload.objectiveDistribution).toEqual([
      expect.objectContaining({
        objectiveCategory: "CONVERSIONS",
        spend: 100,
        results: 10,
        percent: 50
      }),
      expect.objectContaining({
        objectiveCategory: "ENGAGEMENT",
        spend: 60,
        results: 12,
        percent: 30
      }),
      expect.objectContaining({
        objectiveCategory: "TRAFFIC",
        spend: 40,
        results: 20,
        percent: 20
      })
    ]);
    expect(payload.statusDistribution).toEqual([
      expect.objectContaining({
        deliveryGroup: "ACTIVE",
        spend: 160,
        results: 22,
        percent: 80
      }),
      expect.objectContaining({
        deliveryGroup: "PAUSED",
        spend: 40,
        results: 20,
        percent: 20
      })
    ]);
    expect(payload.verticalDistribution).toEqual([
      expect.objectContaining({
        verticalTag: "VIASOFT",
        spend: 160,
        results: 22,
        percent: 80
      }),
      expect.objectContaining({
        verticalTag: "VOORS",
        spend: 40,
        results: 20,
        percent: 20
      })
    ]);
  });

  it("filters the executive payload by verticalTag and deliveryGroup", async () => {
    const payload = await getExecutivePayloadFromStore({
      verticalTag: "VIASOFT",
      deliveryGroup: "ACTIVE",
      rangeDays: 28
    });

    expect(payload.campaigns.map((item) => item.campaign.id)).toEqual(["camp-1", "camp-3"]);
    expect(payload.globalMetrics.spend).toBe(160);
    expect(payload.statusDistribution).toEqual([
      expect.objectContaining({
        deliveryGroup: "ACTIVE",
        spend: 160,
        results: 22
      })
    ]);
    expect(payload.verticalDistribution).toEqual([
      expect.objectContaining({
        verticalTag: "VIASOFT",
        spend: 160,
        results: 22
      })
    ]);
  });

  it("preserves campaignId in the drill-down URL while keeping global filters canonical", () => {
    const href = buildDashboardHref({
      pathname: "/dashboard/campanhas",
      verticalTag: "VIASOFT",
      deliveryGroup: "ACTIVE",
      rangeDays: 30,
      campaignId: "camp-1",
      includeCampaignId: true
    });

    expect(href).toBe(
      "/dashboard/campanhas?verticalTag=VIASOFT&deliveryGroup=ACTIVE&rangeDays=30&campaignId=camp-1"
    );

    expect(
      buildDashboardHref({
        pathname: "/dashboard/executivo",
        verticalTag: "VIASOFT",
        deliveryGroup: "ACTIVE",
        rangeDays: 30,
        campaignId: "camp-1",
        includeCampaignId: false
      })
    ).toBe("/dashboard/executivo?verticalTag=VIASOFT&deliveryGroup=ACTIVE&rangeDays=30");

    expect(
      getDashboardInitialState(
        new URLSearchParams("verticalTag=VIASOFT&deliveryGroup=ACTIVE&rangeDays=30&campaignId=camp-1")
      )
    ).toEqual(
      expect.objectContaining({
        initialVerticalTag: "VIASOFT",
        initialDeliveryGroup: "ACTIVE",
        initialRangeDays: 30,
        initialCampaignId: "camp-1"
      })
    );
  });
});
