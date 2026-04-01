import type { MetaAd, MetaAdPreview } from "@/lib/types";

type AdCreativeSummary = Pick<MetaAd, "creativeName" | "creativePreviewUrl">;

export type CreativeFeedback = {
  category: "ready" | "not_enriched" | "preview_unavailable";
  label: string;
  detail: string;
};

export type PreviewFailureFeedback = {
  category: "permission_blocked" | "not_enriched" | "preview_unavailable";
  title: string;
  detail: string;
};

const NATIVE_PREVIEW_WIDTH_BY_FORMAT: Record<string, number> = {
  DESKTOP_FEED_STANDARD: 320,
  MOBILE_FEED_STANDARD: 320,
  INSTAGRAM_STANDARD: 320
};

const MIN_PREVIEW_RENDER_WIDTH_PX = 280;
const MAX_PREVIEW_RENDER_WIDTH_PX = 560;
const MIN_PREVIEW_RENDER_HEIGHT_PX = 420;
const MAX_PREVIEW_RENDER_HEIGHT_PX = 1400;
const DEFAULT_PREVIEW_HEIGHT_PX = 850;
const MEDIUM_PREVIEW_WIDE_THRESHOLD_PX = 420;
const LARGE_PREVIEW_WIDE_THRESHOLD_PX = 480;
const MEDIUM_PREVIEW_VIEWPORT_SCALE = 1.75;
const LARGE_PREVIEW_VIEWPORT_SCALE = 1.9;
const MAX_PREVIEW_VIEWPORT_WIDTH_PX = 960;

function isGenericCreativeName(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return !normalized || normalized === "criativo não identificado" || normalized === "criativo nao identificado";
}

export function getCreativeFeedback(ad: AdCreativeSummary): CreativeFeedback {
  if (ad.creativePreviewUrl) {
    return {
      category: "ready",
      label: "Preview pronto",
      detail: "Criativo enriquecido com miniatura disponível."
    };
  }

  if (isGenericCreativeName(ad.creativeName)) {
    return {
      category: "not_enriched",
      label: "Enriquecimento pendente",
      detail: "A sync ainda nao trouxe miniatura nem nome confiavel do criativo."
    };
  }

  return {
    category: "preview_unavailable",
    label: "Miniatura indisponível",
    detail: "O criativo foi identificado, mas a Meta nao retornou uma miniatura utilizavel."
  };
}

export function getPreviewFailureFeedback(params: {
  ad: AdCreativeSummary;
  errorMessage?: string | null;
}): PreviewFailureFeedback {
  const message = params.errorMessage?.trim() ?? "";
  const normalized = message.toLowerCase();

  if (
    normalized.includes("permiss") ||
    normalized.includes("profile") ||
    normalized.includes("perfil") ||
    normalized.includes("política")
  ) {
    return {
      category: "permission_blocked",
      title: "Preview bloqueado pela Meta",
      detail:
        message ||
        "A Meta restringiu a visualizacao incorporada deste anuncio por permissao, politica ou contexto do perfil."
    };
  }

  const creativeFeedback = getCreativeFeedback(params.ad);
  if (creativeFeedback.category === "not_enriched") {
    return {
      category: "not_enriched",
      title: "Criativo ainda não enriquecido",
      detail: creativeFeedback.detail
    };
  }

  return {
    category: "preview_unavailable",
    title: "Preview indisponível",
    detail:
      message ||
      "A Meta nao retornou um preview incorporavel para este anuncio nesta tentativa."
  };
}

export function normalizePreviewRenderWidth(width: number | string | null | undefined): number | null {
  const parsed =
    typeof width === "number"
      ? width
      : typeof width === "string"
        ? Number.parseInt(width, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return null;
  }

  const normalized = Math.round(parsed);
  if (normalized < MIN_PREVIEW_RENDER_WIDTH_PX || normalized > MAX_PREVIEW_RENDER_WIDTH_PX) {
    return null;
  }

  return normalized;
}

export function normalizePreviewRenderHeight(height: number | string | null | undefined): number | null {
  const parsed =
    typeof height === "number"
      ? height
      : typeof height === "string"
        ? Number.parseFloat(height)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return null;
  }

  const normalized = Math.round(parsed);
  if (normalized < MIN_PREVIEW_RENDER_HEIGHT_PX || normalized > MAX_PREVIEW_RENDER_HEIGHT_PX) {
    return null;
  }

  return normalized;
}

export function extractPreviewRenderWidthFromHtml(html: string): number | null {
  if (!html.trim()) {
    return null;
  }

  const candidates = new Set<number>();
  const patterns = [
    /style=(["'])(?:(?!\1).)*?\bwidth\s*:\s*(\d{2,4})px(?:(?!\1).)*?\1/gi,
    /\bwidth=(["']?)(\d{2,4})\1/gi
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const candidate = normalizePreviewRenderWidth(match[2]);
      if (candidate !== null) {
        candidates.add(candidate);
      }
    }
  }

  if (candidates.size === 0) {
    return null;
  }

  return Math.max(...candidates);
}

export function extractPreviewRenderHeightFromHtml(html: string): number | null {
  if (!html.trim()) {
    return null;
  }

  const candidates = new Set<number>();
  const patterns = [
    /style=(["'])(?:(?!\1).)*?\bheight\s*:\s*(\d{2,4}(?:\.\d+)?)px(?:(?!\1).)*?\1/gi,
    /\bheight=(["']?)(\d{2,4}(?:\.\d+)?)\1/gi
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const candidate = normalizePreviewRenderHeight(match[2]);
      if (candidate !== null) {
        candidates.add(candidate);
      }
    }
  }

  if (candidates.size === 0) {
    return null;
  }

  return Math.max(...candidates);
}

export function resolvePreviewCanvasWidth(preview?: Pick<MetaAdPreview, "adFormat" | "renderWidth"> | null): number {
  const extractedWidth = normalizePreviewRenderWidth(preview?.renderWidth);
  if (extractedWidth !== null) {
    return extractedWidth;
  }

  const adFormat = preview?.adFormat;
  const normalized = adFormat?.trim().toUpperCase() ?? "";
  return NATIVE_PREVIEW_WIDTH_BY_FORMAT[normalized] ?? 320;
}

export function resolvePreviewIframeWidth(preview?: Pick<MetaAdPreview, "adFormat" | "renderWidth"> | null): number {
  const baseWidth = resolvePreviewCanvasWidth(preview);
  if (baseWidth >= LARGE_PREVIEW_WIDE_THRESHOLD_PX) {
    return Math.min(Math.round(baseWidth * LARGE_PREVIEW_VIEWPORT_SCALE), MAX_PREVIEW_VIEWPORT_WIDTH_PX);
  }

  if (baseWidth >= MEDIUM_PREVIEW_WIDE_THRESHOLD_PX) {
    return Math.min(Math.round(baseWidth * MEDIUM_PREVIEW_VIEWPORT_SCALE), MAX_PREVIEW_VIEWPORT_WIDTH_PX);
  }

  return baseWidth;
}

export function resolvePreviewCanvasHeight(preview?: Pick<MetaAdPreview, "renderHeight"> | null): number {
  return normalizePreviewRenderHeight(preview?.renderHeight) ?? DEFAULT_PREVIEW_HEIGHT_PX;
}
