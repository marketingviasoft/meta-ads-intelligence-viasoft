import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
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
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

vi.mock("@/lib/cache", () => ({
  cache: {
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
  },
}));

// Mock the util so we have a predictable past date range excluding today
vi.mock("@/utils/date-range", () => ({
  buildDateRange: vi.fn(() => ({
    since: "2023-10-01",
    until: "2023-10-14", // if today is 15th, 'until' is 14th
    previousSince: "2023-09-17",
    previousUntil: "2023-09-30",
  })),
  isValidRangeDays: vi.fn(() => true)
}));

import { getDashboardPayloadFromStore } from "@/lib/meta-insights-store";
import { supabase } from "@/lib/supabaseClient.js";

describe("Performance Rules (Visual Aggregation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should aggregate data excluding the current day based on date-range until", async () => {
    // Current period rows - mock data up to the 14th
    const currentRows = [
      { date: "2023-10-12", spend: "100", clicks: "10", impressions: "100", campaign_id: "idx", campaign_name: "Campanha Teste" },
      { date: "2023-10-13", spend: "200", clicks: "20", impressions: "200", campaign_id: "idx", campaign_name: "Campanha Teste" },
      { date: "2023-10-14", spend: "300", clicks: "30", impressions: "300", campaign_id: "idx", campaign_name: "Campanha Teste" }
    ];

    const previousRows = [
      { date: "2023-09-30", spend: "50", clicks: "5", impressions: "50", campaign_id: "idx", campaign_name: "Campanha Teste" }
    ];

    (supabase.from as any).mockImplementation((table: string) => {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ 
          data: { campaign_name: "Campanha Teste", objective: "CONVERSIONS" }, 
          error: null 
        }),
        range: vi.fn()
          // First fetch is current range
          .mockResolvedValueOnce({ data: currentRows, error: null })
          .mockResolvedValueOnce({ data: [], error: null })
          // Second fetch is previous range
          .mockResolvedValueOnce({ data: previousRows, error: null })
          .mockResolvedValueOnce({ data: [], error: null })
      };
    });

    const payload = await getDashboardPayloadFromStore({
      campaignId: "idx",
      rangeDays: 7
    });

    // It should have aggregated only up to the 14th (the mocked until date)
    // 100+200+300 = 600 spend
    expect(payload.comparison.current.spend).toBe(600);
    expect(payload.comparison.previous.spend).toBe(50);
  });
});
