import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePdfPagePlan } from "@/lib/pdf-page-plan";

function extractMarkers(source: string, attribute: string): string[] {
  const pattern = new RegExp(`${attribute}="([^"]+)"`, "g");
  const markers = new Set<string>();

  for (const match of source.matchAll(pattern)) {
    if (match[1]) {
      markers.add(match[1]);
    }
  }

  return [...markers];
}

describe("PDF parity contract", () => {
  it("keeps pagination aligned with the conditional comparison page", () => {
    expect(
      resolvePdfPagePlan({
        hasAdSetComparisonSelection: false,
        hasAdComparisonSelection: false
      })
    ).toEqual({
      shouldRenderComparisonPage: false,
      totalPages: 4,
      metricsPageNumber: 2,
      trendPageNumber: 3,
      insightsPageNumber: 4
    });

    expect(
      resolvePdfPagePlan({
        hasAdSetComparisonSelection: true,
        hasAdComparisonSelection: false
      })
    ).toEqual({
      shouldRenderComparisonPage: true,
      totalPages: 5,
      metricsPageNumber: 3,
      trendPageNumber: 4,
      insightsPageNumber: 5
    });

    expect(
      resolvePdfPagePlan({
        hasAdSetComparisonSelection: false,
        hasAdComparisonSelection: true
      }).shouldRenderComparisonPage
    ).toBe(true);
  });

  it("matches the PDF blocks declared in the parity contract", () => {
    const rootDir = process.cwd();
    const pdfSource = fs.readFileSync(path.join(rootDir, "app", "pdf", "page.tsx"), "utf8");
    const contract = JSON.parse(
      fs.readFileSync(path.join(rootDir, "docs", "PARITY_CONTRACT.json"), "utf8")
    ) as {
      pdf: {
        pages: Array<{ blocks: string[] }>;
      };
    };

    const pdfBlocks = new Set(extractMarkers(pdfSource, "data-pdf-block"));
    const expectedBlocks = new Set(
      contract.pdf.pages.flatMap((page) => page.blocks).map((block) => block.trim())
    );

    expectedBlocks.forEach((block) => {
      expect(pdfBlocks.has(block) || pdfSource.includes(block)).toBe(true);
    });
  });
});
