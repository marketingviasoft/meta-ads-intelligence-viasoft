import { describe, it, expect, vi } from "vitest";

// Mocking dependencies to avoid environment variable errors during module loading
vi.mock("@/lib/supabaseClient.js", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
}));

vi.mock("@/lib/cache", () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

import { inferObjectiveFromCampaignName, inferObjectiveCategory } from "../lib/objective-helpers";

describe("Objective Inference", () => {
  describe("inferObjectiveFromCampaignName", () => {
    it("should extract objective from standard pattern [TAG] [TAG] [Objective]", () => {
      expect(inferObjectiveFromCampaignName("[VIASOFT] [B2B] [TRAFEGO] Campanha de Teste")).toBe("TRAFEGO");
      expect(inferObjectiveFromCampaignName("[viasoft] [b2b] [engagement] post")).toBe("engagement");
    });

    it("should fallback to CONVERSIONS when standard pattern is not matched", () => {
      expect(inferObjectiveFromCampaignName("Campanha sem padrao correto")).toBe("CONVERSIONS");
      expect(inferObjectiveFromCampaignName("[VIASOFT] Apenas uma tag")).toBe("CONVERSIONS");
      expect(inferObjectiveFromCampaignName("")).toBe("CONVERSIONS");
    });
  });

  describe("inferObjectiveCategory", () => {
    it("should map to TRAFFIC", () => {
      expect(inferObjectiveCategory("trafego")).toBe("TRAFFIC");
      expect(inferObjectiveCategory("tráfego")).toBe("TRAFFIC");
      expect(inferObjectiveCategory("TRÁFEGO")).toBe("TRAFFIC");
      expect(inferObjectiveCategory("TRAFFIC")).toBe("TRAFFIC");
      expect(inferObjectiveCategory("clique")).toBe("TRAFFIC");
    });

    it("should map to ENGAGEMENT", () => {
      expect(inferObjectiveCategory("engajamento")).toBe("ENGAGEMENT");
      expect(inferObjectiveCategory("ENGAJAMENTO")).toBe("ENGAGEMENT");
      expect(inferObjectiveCategory("engagement")).toBe("ENGAGEMENT");
    });

    it("should map to RECOGNITION", () => {
      expect(inferObjectiveCategory("reconhecimento")).toBe("RECOGNITION");
      expect(inferObjectiveCategory("RECONHECIMENTO")).toBe("RECOGNITION");
      expect(inferObjectiveCategory("awareness")).toBe("RECOGNITION");
      expect(inferObjectiveCategory("reach")).toBe("RECOGNITION");
    });

    it("should fallback to CONVERSIONS for unknown strings", () => {
      expect(inferObjectiveCategory("")).toBe("CONVERSIONS");
      expect(inferObjectiveCategory("leads")).toBe("CONVERSIONS");
      expect(inferObjectiveCategory("conversão")).toBe("CONVERSIONS");
      expect(inferObjectiveCategory("abobrinha")).toBe("CONVERSIONS");
    });
  });
});
