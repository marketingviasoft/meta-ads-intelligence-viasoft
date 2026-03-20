import { ObjectiveCategory } from "@/lib/types";

/**
 * Normaliza uma string para comparação (minusculas, sem acentos, trim).
 */
export function normalizeString(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Infere o objetivo da campanha a partir do nome (padrão [TAG] [TAG] [Objetivo]).
 */
export function inferObjectiveFromCampaignName(campaignName: string): string {
  const match = campaignName.match(/^\s*\[[^\]]+\]\s*\[[^\]]+\]\s*\[([^\]]+)\]/u);
  const rawObjective = match?.[1]?.trim();

  if (!rawObjective) {
    return "CONVERSIONS";
  }

  return rawObjective;
}

/**
 * Mapeia uma string de objetivo para a categoria canônica do dashboard.
 */
export function inferObjectiveCategory(rawObjective: string): ObjectiveCategory {
  const objective = normalizeString(rawObjective);

  if (objective.includes("trafego") || objective.includes("traffic") || objective.includes("clique")) {
    return "TRAFFIC";
  }

  if (objective.includes("engajamento") || objective.includes("engagement")) {
    return "ENGAGEMENT";
  }

  if (
    objective.includes("reconhecimento") ||
    objective.includes("awareness") ||
    objective.includes("reach")
  ) {
    return "RECOGNITION";
  }

  return "CONVERSIONS";
}
