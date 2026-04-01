import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const scenarios = {
  "camp-traffic": {
    latestRow: {
      date: "2026-03-31",
      campaign_id: "camp-traffic",
      campaign_name: "[META] [VIASOFT] [TRAFEGO] Campanha Tráfego",
      objective: "OUTCOME_TRAFFIC",
      objective_category: "TRAFFIC"
    },
    adSets: [
      { id: "adset-1", campaign_id: "camp-traffic", name: "Público Aberto", status: "ACTIVE" },
      { id: "adset-2", campaign_id: "camp-traffic", name: "Lookalike", status: "PAUSED" }
    ],
    currentRows: [
      {
        date: "2026-03-29",
        campaign_id: "camp-traffic",
        adset_id: "adset-1",
        spend: "30",
        impressions: "1000",
        clicks: "15",
        link_clicks: "12",
        conversions: "0",
        purchases: "0",
        leads: "0",
        actions: { link_click: 12 }
      },
      {
        date: "2026-03-30",
        campaign_id: "camp-traffic",
        adset_id: "adset-1",
        spend: "20",
        impressions: "600",
        clicks: "10",
        link_clicks: "6",
        conversions: "0",
        purchases: "0",
        leads: "0",
        actions: { link_click: 6 }
      },
      {
        date: "2026-03-30",
        campaign_id: "camp-traffic",
        adset_id: "adset-2",
        spend: "10",
        impressions: "300",
        clicks: "4",
        link_clicks: "3",
        conversions: "0",
        purchases: "0",
        leads: "0",
        actions: { link_click: 3 }
      }
    ],
    previousRows: [
      {
        date: "2026-03-22",
        campaign_id: "camp-traffic",
        adset_id: "adset-1",
        spend: "20",
        impressions: "800",
        clicks: "8",
        link_clicks: "8",
        conversions: "0",
        purchases: "0",
        leads: "0",
        actions: { link_click: 8 }
      },
      {
        date: "2026-03-23",
        campaign_id: "camp-traffic",
        adset_id: "adset-2",
        spend: "12",
        impressions: "500",
        clicks: "5",
        link_clicks: "4",
        conversions: "0",
        purchases: "0",
        leads: "0",
        actions: { link_click: 4 }
      }
    ]
  },
  "camp-conv": {
    latestRow: {
      date: "2026-03-31",
      campaign_id: "camp-conv",
      campaign_name: "[META] [VIASOFT] [CONVERSAO] Campanha Conversão",
      objective: "OUTCOME_SALES",
      objective_category: "CONVERSIONS"
    },
    adSets: [
      { id: "conv-adset-1", campaign_id: "camp-conv", name: "Lead Form", status: "ACTIVE" }
    ],
    currentRows: [
      {
        date: "2026-03-30",
        campaign_id: "camp-conv",
        adset_id: "conv-adset-1",
        spend: "50",
        impressions: "900",
        clicks: "25",
        conversions: "7",
        purchases: "0",
        leads: "7",
        actions: { lead: 7 }
      }
    ],
    previousRows: [
      {
        date: "2026-03-23",
        campaign_id: "camp-conv",
        adset_id: "conv-adset-1",
        spend: "60",
        impressions: "1000",
        clicks: "30",
        conversions: "5",
        purchases: "0",
        leads: "5",
        actions: { lead: 5 }
      }
    ]
  }
} as const;

vi.mock("@/lib/supabaseClient.js", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "meta_adsets") {
        let campaignId = "";

        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn((field: string, value: string) => {
            if (field === "campaign_id") {
              campaignId = value;
            }

            return chain;
          }),
          order: vi.fn().mockReturnThis(),
          range: vi.fn(async () => ({
            data: scenarios[campaignId as keyof typeof scenarios]?.adSets ?? [],
            error: null
          }))
        };

        return chain;
      }

      if (table === "meta_campaign_insights") {
        let campaignId = "";
        let since = "";
        let until = "";

        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn((field: string, value: string) => {
            if (field === "campaign_id") {
              campaignId = value;
            }

            return chain;
          }),
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
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(async () => ({
            data: scenarios[campaignId as keyof typeof scenarios]?.latestRow ?? null,
            error: null
          })),
          range: vi.fn(async () => {
            const scenario = scenarios[campaignId as keyof typeof scenarios];
            if (!scenario) {
              return { data: [], error: null };
            }

            if (since === "2026-03-25" && until === "2026-03-31") {
              return { data: scenario.currentRows, error: null };
            }

            if (since === "2026-03-18" && until === "2026-03-24") {
              return { data: scenario.previousRows, error: null };
            }

            return { data: [], error: null };
          })
        };

        return chain;
      }

      throw new Error(`Tabela inesperada no mock: ${table}`);
    })
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
    since: "2026-03-25",
    until: "2026-03-31",
    previousSince: "2026-03-18",
    previousUntil: "2026-03-24"
  })),
  isValidRangeDays: vi.fn(() => true)
}));

import { GET } from "@/app/api/meta/adsets/route";
import { getCampaignAdSetsWithMetricsFromStore } from "@/lib/meta-insights-store";

describe("Ad set performance aggregation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  });

  it("aggregates traffic metrics by adset_id using link clicks as the primary result", async () => {
    const adSets = await getCampaignAdSetsWithMetricsFromStore({
      campaignId: "camp-traffic",
      rangeDays: 7
    });

    expect(adSets).toHaveLength(2);
    expect(adSets[0]).toEqual(
      expect.objectContaining({
        id: "adset-1",
        objectiveCategory: "TRAFFIC",
        metrics: expect.objectContaining({
          spend: 50,
          impressions: 1600,
          clicks: 25,
          results: 18,
          primaryMetricLabel: "Cliques no link"
        }),
        previousMetrics: expect.objectContaining({
          results: 8
        }),
        deltas: expect.objectContaining({
          results: expect.objectContaining({
            absolute: 10,
            percent: 125
          })
        })
      })
    );
    expect(adSets[1]?.metrics?.results).toBe(3);
    expect(adSets[1]?.deltas?.results.absolute).toBe(-1);
  });

  it("preserves conversion semantics when the campaign objective is conversions", async () => {
    const adSets = await getCampaignAdSetsWithMetricsFromStore({
      campaignId: "camp-conv",
      rangeDays: 7
    });

    expect(adSets).toHaveLength(1);
    expect(adSets[0]).toEqual(
      expect.objectContaining({
        objectiveCategory: "CONVERSIONS",
        metrics: expect.objectContaining({
          results: 7,
          costPerResult: 50 / 7,
          primaryMetricLabel: "Conversões"
        }),
        previousMetrics: expect.objectContaining({
          results: 5
        })
      })
    );
  });

  it("returns the enriched adset payload through the route", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/meta/adsets?campaignId=camp-traffic&rangeDays=14")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.meta).toEqual(
      expect.objectContaining({
        campaignId: "camp-traffic",
        rangeDays: 14,
        count: 2
      })
    );
    expect(payload.data[0]).toEqual(
      expect.objectContaining({
        id: "adset-1",
        metrics: expect.objectContaining({
          results: 18
        })
      })
    );
  });
});
