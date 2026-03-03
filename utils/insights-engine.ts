import type {
  InsightMessage,
  MetricComparison,
  ObjectiveCategory,
  Recommendation
} from "@/lib/types";
import { formatCurrencyBRL, formatPercentBR, formatSignedPercentBR } from "@/utils/formatters";

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
        "Priorize três variações criativas com CTA explícito no início da peça para ampliar link_clicks sem expansão imediata de orçamento."
      );
      if (flags.highCpc) {
        pushRecommendation(
          recommendations,
          "Otimização de CPC",
          "Reavalie segmentações de maior custo e reduza sobreposição de audiência para elevar a eficiência de clique."
        );
      }
      if (flags.dropResults) {
        pushRecommendation(
          recommendations,
          "Recuperação de volume qualificado",
          "Realoque investimento para conjuntos com melhor histórico de CTR e interrompa variações de baixo desempenho por 48h."
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
        "Priorize criativos com prova social e chamada objetiva para ampliar post_engagement com eficiência de custo."
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
          "Concentre investimento em posicionamentos com CPM mais competitivo e criativos com alto índice de conclusão visual."
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
          "Reestruture título e CTA com benefício objetivo e urgência para ampliar taxa de clique qualificado."
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
}): {
  insights: InsightMessage[];
  recommendations: Recommendation[];
} {
  const { category, comparison } = params;
  const { current, deltas, trend } = comparison;

  const lowCtr = current.ctr < CTR_BASELINE[category];
  const highCpc = current.cpc > CPC_LIMIT[category];
  const highCostPerResult =
    current.costPerResult !== null && (deltas.costPerResult.percent ?? 0) >= 10;
  const dropResults = (deltas.results.percent ?? 0) <= -10;

  const insights: InsightMessage[] = [];

  if (lowCtr) {
    insights.push({
      type: "alert",
      title: "CTR abaixo da referência esperada",
      message: `CTR atual em ${formatPercentBR(current.ctr)}. Referência para ${category.toLowerCase()} em ${formatPercentBR(CTR_BASELINE[category])}.`
    });
  }

  if (highCpc) {
    insights.push({
      type: "alert",
      title: "CPC acima da faixa de eficiência",
      message: `CPC atual em ${formatCurrencyBRL(current.cpc)}. Faixa de referência para ${category.toLowerCase()} em ${formatCurrencyBRL(CPC_LIMIT[category])}.`
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

  if (!lowCtr && !highCpc && (deltas.results.percent ?? 0) >= 8) {
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

  insights.push({
    type: trend.direction === "negative" ? "alert" : "info",
    title: "Leitura estratégica de tendência",
    message: trend.message
  });

  const recommendations = buildObjectiveRecommendations(category, {
    lowCtr,
    highCpc,
    highCostPerResult,
    dropResults
  });

  return {
    insights: insights.slice(0, 4),
    recommendations
  };
}
