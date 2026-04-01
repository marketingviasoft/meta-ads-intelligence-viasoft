import { describe, expect, it } from "vitest";
import {
  extractPreviewRenderHeightFromHtml,
  extractPreviewRenderWidthFromHtml,
  getCreativeFeedback,
  getPreviewFailureFeedback,
  normalizePreviewRenderHeight,
  normalizePreviewRenderWidth,
  resolvePreviewCanvasHeight,
  resolvePreviewCanvasWidth,
  resolvePreviewIframeWidth
} from "@/utils/ad-preview";

describe("Ad preview fallbacks", () => {
  it("flags creative enrichment as pending when name and thumbnail are both missing", () => {
    expect(
      getCreativeFeedback({
        creativeName: "Criativo não identificado",
        creativePreviewUrl: ""
      })
    ).toEqual(
      expect.objectContaining({
        category: "not_enriched",
        label: "Enriquecimento pendente"
      })
    );
  });

  it("distinguishes permission-blocked previews from generic unavailability", () => {
    expect(
      getPreviewFailureFeedback({
        ad: {
          creativeName: "Criativo institucional",
          creativePreviewUrl: ""
        },
        errorMessage: "A Meta bloqueou este preview por permissão ou política do perfil."
      })
    ).toEqual(
      expect.objectContaining({
        category: "permission_blocked",
        title: "Preview bloqueado pela Meta"
      })
    );

    expect(
      getPreviewFailureFeedback({
        ad: {
          creativeName: "Criativo institucional",
          creativePreviewUrl: ""
        },
        errorMessage: "A Meta retornou um preview não incorporável para este anúncio."
      })
    ).toEqual(
      expect.objectContaining({
        category: "preview_unavailable",
        title: "Preview indisponível"
      })
    );
  });

  it("normalizes extracted render widths within the supported range", () => {
    expect(normalizePreviewRenderWidth(320)).toBe(320);
    expect(normalizePreviewRenderWidth("500")).toBe(500);
    expect(normalizePreviewRenderWidth(120)).toBeNull();
    expect(normalizePreviewRenderWidth(720)).toBeNull();
    expect(normalizePreviewRenderWidth(undefined)).toBeNull();
  });

  it("normalizes extracted render heights within the supported range", () => {
    expect(normalizePreviewRenderHeight(614.83)).toBe(615);
    expect(normalizePreviewRenderHeight("896.96")).toBe(897);
    expect(normalizePreviewRenderHeight(320)).toBeNull();
    expect(normalizePreviewRenderHeight(1800)).toBeNull();
    expect(normalizePreviewRenderHeight(undefined)).toBeNull();
  });

  it("extracts a trustworthy render width from preview HTML when present", () => {
    expect(
      extractPreviewRenderWidthFromHtml(`
        <div class="foo">
          <div style="width: 500px;"></div>
          <div width="320"></div>
        </div>
      `)
    ).toBe(500);

    expect(
      extractPreviewRenderWidthFromHtml(`
        <div>
          <div style="width: 240px;"></div>
          <div width="1024"></div>
        </div>
      `)
    ).toBeNull();
  });

  it("extracts a trustworthy render height from preview HTML when present", () => {
    expect(
      extractPreviewRenderHeightFromHtml(`
        <div class="foo">
          <div style="height: 896.96px;"></div>
          <div height="614.83"></div>
        </div>
      `)
    ).toBe(897);

    expect(
      extractPreviewRenderHeightFromHtml(`
        <div>
          <div style="height: 240px;"></div>
          <div height="1810"></div>
        </div>
      `)
    ).toBeNull();
  });

  it("uses extracted render widths first and falls back safely by ad format", () => {
    expect(
      resolvePreviewCanvasWidth({
        adFormat: "DESKTOP_FEED_STANDARD",
        renderWidth: 500
      })
    ).toBe(500);
    expect(
      resolvePreviewCanvasWidth({
        adFormat: "MOBILE_FEED_STANDARD"
      })
    ).toBe(320);
    expect(
      resolvePreviewCanvasWidth({
        adFormat: "UNKNOWN_FORMAT"
      })
    ).toBe(320);
    expect(resolvePreviewCanvasWidth(undefined)).toBe(320);
    expect(
      resolvePreviewIframeWidth({
        adFormat: "DESKTOP_FEED_STANDARD",
        renderWidth: 500
      })
    ).toBe(950);
    expect(
      resolvePreviewIframeWidth({
        adFormat: "MOBILE_FEED_STANDARD",
        renderWidth: 320
      })
    ).toBe(320);
    expect(
      resolvePreviewIframeWidth({
        adFormat: "UNKNOWN_FORMAT",
        renderWidth: 430
      })
    ).toBe(753);
    expect(resolvePreviewCanvasHeight({ renderHeight: 897 })).toBe(897);
    expect(resolvePreviewCanvasHeight(undefined)).toBe(850);
  });
});
