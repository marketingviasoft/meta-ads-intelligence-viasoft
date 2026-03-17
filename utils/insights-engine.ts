import type {
  InsightMessage,
  MetricComparison,
  ObjectiveCategory,
  Recommendation
} from "@/lib/types";
import {
  formatCurrencyBRL,
  formatNumberBR,
  formatPercentBR,
  formatSignedPercentBR
} from "@/utils/formatters";

const CTR_BASELINE: Record<ObjectiveCategory, number> = {
  TRAFFIC: 1.2,
  ENGAGEMENT: 1,
  RECOGNITION: 0.8,
  CONVERSIONS: 1.4
};

const CPC_LIMIT: Record<ObjectiveCategory, number> = {
  TRAFFIC: 2.8,
  ENGAGEMENT: 2.4,
  RECOGNITION: 1.9,
  CONVERSIONS: 6.2
};

const DEFAULT_MIN_IMPRESSIONS = 1000;
const DEFAULT_MIN_CLICKS = 30;
const DEFAULT_MIN_RESULTS = 5;

type BaselineOverride = {
  ctr?: number;
  cpc?: number;
};

type ObjectiveBaselineOverrides = Partial<Record<ObjectiveCategory, BaselineOverride>>;
type VerticalBaselineOverrides = Record<string, ObjectiveBaselineOverrides>;

type BaselineResolution = {
  ctrBaseline: number;
  cpcLimit: number;
  source: "default" | "account" | "vertical";
  sourceLabel: string;
};

function getObjectiveLabel(category: ObjectiveCategory): string {
  switch (category) {
    case "TRAFFIC":
      return "tráfego";
    case "ENGAGEMENT":
      return "engajamento";
    case "RECOGNITION":
      return "reconhecimento";
    case "CONVERSIONS":
      return "conversão";
    default:
      return "objetivo atual";
  }
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parsePositiveNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}

function toObjectiveCategory(value: string): ObjectiveCategory | null {
  const normalized = value.trim().toUpperCase();
  if (
    normalized === "TRAFFIC" ||
    normalized === "ENGAGEMENT" ||
    normalized === "RECOGNITION" ||
    normalized === "CONVERSIONS"
  ) {
    return normalized;
  }

  return null;
}

function parseObjectiveBaselineConfig(raw: string | undefined): ObjectiveBaselineOverrides {
  if (!raw?.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const entries = Object.entries(parsed as Record<string, unknown>);
    const overrides: ObjectiveBaselineOverrides = {};

    for (const [objectiveKey, objectiveValue] of entries) {
      const objectiveCategory = toObjectiveCategory(objectiveKey);
      if (!objectiveCategory || !objectiveValue || typeof objectiveValue !== "object") {
        continue;
      }

      const rawOverride = objectiveValue as Record<string, unknown>;
      const ctr = parsePositiveNumber(rawOverride.ctr);
      const cpc = parsePositiveNumber(rawOverride.cpc);

      if (ctr === undefined && cpc === undefined) {
        continue;
      }

      overrides[objectiveCategory] = {
        ...(ctr !== undefined ? { ctr } : {}),
        ...(cpc !== undefined ? { cpc } : {})
      };
    }

    return overrides;
  } catch {
    return {};
  }
}

function parseVerticalBaselineConfig(raw: string | undefined): VerticalBaselineOverrides {
  if (!raw?.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const normalizedMap: VerticalBaselineOverrides = {};

    for (const [verticalKey, verticalValue] of Object.entries(parsed as Record<string, unknown>)) {
      if (!verticalValue || typeof verticalValue !== "object" || Array.isArray(verticalValue)) {
        continue;
      }

      const normalizedVertical = normalizeKey(verticalKey);
      if (!normalizedVertical) {
        continue;
      }

      const overrides = parseObjectiveBaselineConfig(JSON.stringify(verticalValue));
      if (Object.keys(overrides).length === 0) {
        continue;
      }

      normalizedMap[normalizedVertical] = overrides;
    }

    return normalizedMap;
  } catch {
    return {};
  }
}

function readMinThreshold(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  const parsed = parsePositiveNumber(raw);
  if (parsed === undefined) {
    return fallback;
  }

  return Math.round(parsed);
}

function resolveBaseline(params: {
  category: ObjectiveCategory;
  verticalTag?: string;
}): BaselineResolution {
  const { category, verticalTag } = params;

  let ctrBaseline = CTR_BASELINE[category];
  let cpcLimit = CPC_LIMIT[category];
  let source: BaselineResolution["source"] = "default";
  let sourceLabel = "conta padrão";

  const accountOverrides = parseObjectiveBaselineConfig(
    process.env.INSIGHTS_BASELINE_ACCOUNT_JSON
  );
  const accountOverride = accountOverrides[category];
  if (accountOverride) {
    if (accountOverride.ctr !== undefined) {
      ctrBaseline = accountOverride.ctr;
    }
    if (accountOverride.cpc !== undefined) {
      cpcLimit = accountOverride.cpc;
    }
    source = "account";
    sourceLabel = "conta";
  }

  const normalizedVertical = normalizeKey(verticalTag ?? "");
  if (normalizedVertical) {
    const verticalOverrides = parseVerticalBaselineConfig(
      process.env.INSIGHTS_BASELINE_BY_VERTICAL_JSON
    );
    const verticalOverride = verticalOverrides[normalizedVertical]?.[category];
    if (verticalOverride) {
      if (verticalOverride.ctr !== undefined) {
        ctrBaseline = verticalOverride.ctr;
      }
      if (verticalOverride.cpc !== undefined) {
        cpcLimit = verticalOverride.cpc;
      }
      source = "vertical";
      sourceLabel = `vertical ${verticalTag?.trim() || normalizedVertical}`;
    }
  }

  return {
    ctrBaseline,
    cpcLimit,
    source,
    sourceLabel
  };
}

function pushRecommendation(target: Recommendation[], title: string, message: string): void {
  if (target.some((item) => item.title === title)) {
    return;
  }

  target.push({
    title,
    message
  });
}

function buildObjectiveRecommendations(
  category: ObjectiveCategory,
  flags: {
    lowCtr: boolean;
    highCpc: boolean;
    highCostPerResult: boolean;
    dropResults: boolean;
  }
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  switch (category) {
    case "TRAFFIC":
      pushRecommendation(
        recommendations,
        "Estratégia criativa para cliques",
        "Priorize três variações criativas com chamada clara para ação logo no início da peça, buscando ampliar cliques qualificados sem expansão imediata de orçamento."
      );
      if (flags.highCpc) {
        pushRecommendation(
          recommendations,
          "Otimização do custo por clique",
          "Reavalie segmentações de maior custo e reduza sobreposição de audiência para elevar a eficiência dos cliques."
        );
      }
      if (flags.dropResults) {
        pushRecommendation(
          recommendations,
          "Recuperação de volume qualificado",
          "Realoque investimento para conjuntos com melhor histórico de taxa de cliques e interrompa variações de baixo desempenho por 48h."
        );
      }
      if (flags.highCostPerResult) {
        pushRecommendation(
          recommendations,
          "Recalibração de custo por resultado",
          "Ajuste criativos e segmentações de menor resposta para reduzir custo por resultado antes de nova escala de investimento."
        );
      }
      break;

    case "ENGAGEMENT":
      pushRecommendation(
        recommendations,
        "Qualificação do engajamento",
        "Priorize criativos com prova social e mensagem objetiva para ampliar as interações com o anúncio com eficiência de custo."
      );
      if (flags.lowCtr) {
        pushRecommendation(
          recommendations,
          "Otimização da abertura de mensagem",
          "Fortaleça o gancho inicial do texto e da miniatura para melhorar a atenção nos primeiros segundos de entrega."
        );
      }
      if (flags.dropResults) {
        pushRecommendation(
          recommendations,
          "Cadência editorial",
          "Amplie a frequência de variações criativas curtas e evite repetição da mesma peça por mais de cinco dias consecutivos."
        );
      }
      if (flags.highCostPerResult) {
        pushRecommendation(
          recommendations,
          "Eficiência de custo por resposta",
          "Priorize formatos com maior interação orgânica para reduzir custo por resultado sem perda de distribuição."
        );
      }
      break;

    case "RECOGNITION":
      pushRecommendation(
        recommendations,
        "Cobertura com eficiência",
        "Maximize alcance incremental em segmentos amplos e monitore sobreposição para manter volume de impressões com custo controlado."
      );
      if (flags.highCpc) {
        pushRecommendation(
          recommendations,
          "Eficiência de compra de mídia",
          "Concentre investimento em posicionamentos com custo mais competitivo por mil impressões e criativos com alto índice de conclusão visual."
        );
      }
      if (flags.dropResults) {
        pushRecommendation(
          recommendations,
          "Estabilidade de alcance",
          "Escale gradualmente os conjuntos que sustentam impressão diária para reduzir oscilações entre períodos."
        );
      }
      if (flags.highCostPerResult) {
        pushRecommendation(
          recommendations,
          "Eficiência de impressão efetiva",
          "Teste criativos mais curtos e diretos para elevar entrega útil e reduzir custo por resultado em campanhas de awareness."
        );
      }
      break;

    case "CONVERSIONS":
      pushRecommendation(
        recommendations,
        "Conversão orientada à oferta",
        "Alinhe criativo e proposta de valor ao estágio do funil para elevar conversões com menor fricção de página."
      );
      if (flags.lowCtr) {
        pushRecommendation(
          recommendations,
          "Otimização pré-clique",
          "Reestruture título e chamada para ação com benefício objetivo e urgência para ampliar a taxa de cliques qualificados."
        );
      }
      if (flags.highCpc || flags.dropResults) {
        pushRecommendation(
          recommendations,
          "Refinamento de público",
          "Separe audiência quente e fria em conjuntos distintos para ajustar lance e reduzir custo por conversão."
        );
      }
      if (flags.highCostPerResult) {
        pushRecommendation(
          recommendations,
          "Aprimoramento de jornada",
          "Revise a fricção entre anúncio e página de destino para ampliar conversão do tráfego já adquirido."
        );
      }
      break;

    default:
      break;
  }

  return recommendations.slice(0, 3);
}

export function generateInsights(params: {
  category: ObjectiveCategory;
  comparison: MetricComparison;
  verticalTag?: string;
}): {
  insights: InsightMessage[];
  recommendations: Recommendation[];
} {
  const { category, comparison, verticalTag } = params;
  const { current, previous, deltas, trend } = comparison;
  const baseline = resolveBaseline({ category, verticalTag });
  const objectiveLabel = getObjectiveLabel(category);

  const minImpressions = readMinThreshold("INSIGHTS_MIN_IMPRESSIONS", DEFAULT_MIN_IMPRESSIONS);
  const minClicks = readMinThreshold("INSIGHTS_MIN_CLICKS", DEFAULT_MIN_CLICKS);
  const minResults = readMinThreshold("INSIGHTS_MIN_RESULTS", DEFAULT_MIN_RESULTS);

  const hasTrafficSample = current.impressions >= minImpressions && current.clicks >= minClicks;
  const hasResultSample = Math.max(current.results, previous.results) >= minResults;

  const lowCtr = hasTrafficSample && current.ctr < baseline.ctrBaseline;
  const highCpc = hasTrafficSample && current.cpc > baseline.cpcLimit;
  const highCostPerResult =
    hasResultSample && current.costPerResult !== null && (deltas.costPerResult.percent ?? 0) >= 10;
  const dropResults = hasResultSample && (deltas.results.percent ?? 0) <= -10;

  const insights: InsightMessage[] = [];

  if (!hasTrafficSample || !hasResultSample) {
    const guardMessages: string[] = [];

    if (!hasTrafficSample) {
      guardMessages.push(
        `tráfego abaixo do mínimo analítico (${formatNumberBR(minImpressions, 0, 0)} impressões e ${formatNumberBR(minClicks, 0, 0)} cliques)`
      );
    }

    if (!hasResultSample) {
      guardMessages.push(
        `volume de resultados abaixo do mínimo analítico (${formatNumberBR(minResults, 0, 0)} resultados)`
      );
    }

    insights.push({
      type: "info",
      title: "Amostra insuficiente para alertas críticos",
      message: `A leitura executiva foi parcialmente limitada por ${guardMessages.join(" e ")} neste período.`
    });
  }

  const baselineSuffix =
    baseline.source === "default" ? "" : ` (referência calibrada de ${baseline.sourceLabel})`;

  if (lowCtr) {
    insights.push({
      type: "alert",
      title: "Taxa de cliques abaixo da referência esperada",
      message: `Taxa de cliques atual em ${formatPercentBR(current.ctr)}. Referência para ${objectiveLabel} em ${formatPercentBR(baseline.ctrBaseline)}${baselineSuffix}.`
    });
  }

  if (highCpc) {
    insights.push({
      type: "alert",
      title: "Custo por clique acima da faixa de eficiência",
      message: `Custo por clique atual em ${formatCurrencyBRL(current.cpc)}. Faixa de referência para ${objectiveLabel} em ${formatCurrencyBRL(baseline.cpcLimit)}${baselineSuffix}.`
    });
  }

  if (dropResults) {
    insights.push({
      type: "alert",
      title: "Redução relevante no desempenho comparativo",
      message: `Resultado principal recuou ${formatSignedPercentBR(deltas.results.percent)} no comparativo direto.`
    });
  }

  if (highCostPerResult) {
    insights.push({
      type: "alert",
      title: "Elevação no custo unitário",
      message: `Custo por resultado avançou ${formatSignedPercentBR(
        deltas.costPerResult.percent
      )} e encerrou em ${formatCurrencyBRL(current.costPerResult)}.`
    });
  }

  if (!lowCtr && !highCpc && hasResultSample && (deltas.results.percent ?? 0) >= 8) {
    insights.push({
      type: "opportunity",
      title: "Ambiente favorável para ampliação gradual de investimento",
      message: "A performance atual permite expansão progressiva de verba com manutenção da eficiência unitária."
    });
  }

  if (insights.length === 0) {
    insights.push({
      type: "info",
      title: "Sem desvios críticos",
      message: "Os indicadores centrais permanecem dentro da faixa esperada no período avaliado."
    });
  }

  const trendInsight: InsightMessage = {
    type: trend.direction === "negative" ? "alert" : "info",
    title: "Leitura estratégica de tendência",
    message: trend.message
  };

  const recommendations = buildObjectiveRecommendations(category, {
    lowCtr,
    highCpc,
    highCostPerResult,
    dropResults
  });

  return {
    insights: [...insights.slice(0, 3), trendInsight].slice(0, 4),
    recommendations
  };
}
