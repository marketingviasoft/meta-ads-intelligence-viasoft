import type { MetaAd } from "@/lib/types";

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
