import { beforeEach, describe, expect, it, vi } from "vitest";

const cronState = vi.hoisted(() => ({
  missingSyncLogsTable: false,
  insertedSyncLogs: [] as Array<Record<string, unknown>>,
  updatedSyncLogs: [] as Array<Record<string, unknown>>,
  upserts: [] as Array<{ table: string; rows: unknown[] }>
}));

vi.mock("@/lib/supabaseClient.js", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "meta_sync_logs") {
        return {
          insert: (rows: Array<Record<string, unknown>>) => {
            cronState.insertedSyncLogs.push(...rows);
            return {
              select: () => ({
                single: async () =>
                  cronState.missingSyncLogsTable
                    ? {
                        data: null,
                        error: new Error('relation "meta_sync_logs" does not exist')
                      }
                    : {
                        data: { id: "sync-log-1" },
                        error: null
                      }
              })
            };
          },
          update: (values: Record<string, unknown>) => ({
            eq: async () => {
              cronState.updatedSyncLogs.push(values);
              return { error: null };
            }
          })
        };
      }

      return {
        upsert: async (rows: unknown[]) => {
          cronState.upserts.push({ table, rows });
          return { error: null };
        }
      };
    })
  }
}));

import { GET } from "@/app/api/cron/sync-meta/route";

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json"
    }
  });
}

const sampleInsightRow = {
  campaign_id: "camp-1",
  campaign_name: "[META] [VIASOFT] [CONVERSAO] Campanha A",
  adset_id: "",
  adset_name: "",
  ad_id: "",
  ad_name: "",
  date_start: "2026-03-03",
  date_stop: "2026-03-03",
  spend: "100",
  impressions: "1000",
  clicks: "10",
  reach: "900",
  frequency: "1.1",
  ctr: "1.0",
  cpc: "10",
  cpm: "100",
  cpp: "111.11",
  unique_clicks: "8",
  conversions: "5",
  quality_ranking: "AVERAGE",
  engagement_rate_ranking: "AVERAGE",
  conversion_rate_ranking: "AVERAGE",
  actions: [],
  cost_per_action_type: []
};

describe("Cron sync log persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:00:00.000Z"));

    cronState.missingSyncLogsTable = false;
    cronState.insertedSyncLogs.length = 0;
    cronState.updatedSyncLogs.length = 0;
    cronState.upserts.length = 0;

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.META_ACCESS_TOKEN = "token";
    process.env.META_AD_ACCOUNT_ID = "123";
    process.env.CRON_SECRET = "secret";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const requestUrl =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const url = new URL(requestUrl);
        const pathname = url.pathname;
        const method = init?.method ?? (input instanceof Request ? input.method : "GET");

        if (method === "POST" && pathname.endsWith("/act_123/insights")) {
          return jsonResponse({ report_run_id: "job-1" });
        }

        if (pathname.endsWith("/job-1")) {
          return jsonResponse({ async_status: "Job Completed", async_percent_completion: 100 });
        }

        if (pathname.endsWith("/job-1/insights")) {
          return jsonResponse({ data: [sampleInsightRow] });
        }

        if (pathname.endsWith("/act_123/campaigns")) {
          return jsonResponse({
            data: [
              {
                id: "camp-1",
                name: "[META] [VIASOFT] [CONVERSAO] Campanha A",
                objective: "OUTCOME_SALES",
                effective_status: "ACTIVE",
                status: "ACTIVE",
                configured_status: "ACTIVE"
              }
            ]
          });
        }

        return jsonResponse({ data: [] });
      })
    );
  });

  it("falls back to console when meta_sync_logs is missing", async () => {
    cronState.missingSyncLogsTable = true;

    const response = await GET(
      new Request("http://localhost/api/cron/sync-meta", {
        headers: {
          authorization: "Bearer secret"
        }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        success: true,
        syncLogPersistence: "console-fallback"
      })
    );
    expect(cronState.insertedSyncLogs).toEqual([
      expect.objectContaining({
        status: "RUNNING",
        sync_version: "sync-meta-v4-shared-resolution"
      })
    ]);
    expect(cronState.updatedSyncLogs).toHaveLength(0);
  });

  it("persists RUNNING and SUCCESS rows in meta_sync_logs when the table exists", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/sync-meta", {
        headers: {
          authorization: "Bearer secret"
        }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        success: true,
        syncLogPersistence: "supabase",
        fetchedRows: 1,
        syncedInsights: 1,
        syncedAdSets: 0,
        syncedAds: 0,
        range: {
          since: "2026-03-03",
          until: "2026-04-01"
        }
      })
    );
    expect(cronState.insertedSyncLogs).toEqual([
      expect.objectContaining({
        status: "RUNNING",
        sync_version: "sync-meta-v4-shared-resolution"
      })
    ]);
    expect(cronState.updatedSyncLogs).toEqual([
      expect.objectContaining({
        status: "SUCCESS",
        fetched_rows: 1,
        synced_insights: 1,
        synced_adsets: 0,
        synced_ads: 0,
        range_since: "2026-03-03",
        range_until: "2026-04-01"
      })
    ]);
    expect(cronState.upserts).toEqual([
      expect.objectContaining({
        table: "meta_campaign_insights",
        rows: expect.any(Array)
      })
    ]);
  });
});
