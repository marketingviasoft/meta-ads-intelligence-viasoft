import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabaseClient.js", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

vi.mock("@/lib/cache", () => ({
  cache: {
    get: vi.fn().mockReturnValue(null), // force fresh
    set: vi.fn(),
  },
}));

vi.mock("@/utils/month-range", () => ({
  buildCurrentMonthToCurrentDateRange: vi.fn(() => ({
    since: "2023-09-24",
    until: "2023-10-23",
    dataUntil: "2023-10-15",
    hasElapsedDays: true,
    includesCurrentDay: true,
    timeZone: "America/Sao_Paulo"
  }))
}));

import { getVerticalBudgetSummaryFromStore } from "@/lib/meta-insights-store";
import { supabase } from "@/lib/supabaseClient.js";

describe("Vertical Budget Rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should calculate budget correctly for typical vertical", async () => {
    // Setup Mock
    const mockRows = [
      { spend: "100", campaign_name: "[B&M] [B2B] Campanha" },
      { spend: "50", campaign_name: "[B&M] [B2C] Campanha 2" },
      { spend: "200", campaign_name: "[VIASOFT] Ignorar" }
    ];
    
    // We mock that it returns the rows in one fetch
    (supabase.from as any).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValueOnce({ data: mockRows, error: null }).mockResolvedValueOnce({ data: [], error: null })
    });

    const summary = await getVerticalBudgetSummaryFromStore({ verticalTag: "B&M" });
    console.log("TEST B&M SUMMARY:", summary);
    expect(summary.spentInMonth).toBe(150);
  });

  it("should enforce exactly R$ 1000 with 12.15% tax cap for VIASOFT vertical (approx 891.66)", async () => {
    const mockRows = [
      { spend: "400", campaign_name: "[VIASOFT] [B2B] Campanha" },
      { spend: "500", campaign_name: "[VIASOFT] [B2B] Campanha" },
    ];
    
    (supabase.from as any).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValueOnce({ data: mockRows, error: null }).mockResolvedValueOnce({ data: [], error: null })
    });

    const summary = await getVerticalBudgetSummaryFromStore({ verticalTag: "VIASOFT" });
    expect(summary.spentInMonth).toBe(900);
    
    // VIASOFT cap should be approx 891.66 (1000 / 1.1215)
    // 900 spent means overbudget 900 - 891.66
    expect(summary.monthlyCap).toBeCloseTo(891.66, 2);
    expect(summary.remainingInMonth).toBe(0);
    expect(summary.overBudgetAmount).toBeCloseTo(900 - 891.66, 2);
  });
});
