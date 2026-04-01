import type { 
  DashboardCampaignSummary, 
  ExecutiveGlobalMetrics, 
  ExecutiveMetricComparison, 
  InsightMessage,
  ObjectiveCategory
} from "@/lib/types";
import { getObjectiveLabel } from "@/utils/labels";

interface ExecutiveInsightsParams {
  campaigns: DashboardCampaignSummary[];
  globalMetrics: ExecutiveGlobalMetrics;
  comparison: ExecutiveMetricComparison;
  objectiveDistribution: {
    objectiveCategory: string;
    spend: number;
    results: number;
    percent: number;
  }[];
}

export function generateExecutiveInsights({
  campaigns,
  globalMetrics,
  comparison,
  objectiveDistribution
}: ExecutiveInsightsParams): InsightMessage[] {
  const insights: InsightMessage[] = [];

  if (campaigns.length === 0 || globalMetrics.spend === 0) {
    return insights;
  }

  // 1. Leitura geral do período vs período anterior
  const spendDelta = comparison.deltas.spend.percent;
  const resultsDelta = comparison.deltas.results.percent;
  
  if (spendDelta !== null && resultsDelta !== null) {
    if (spendDelta > 0 && resultsDelta > spendDelta) {
      insights.push({
        type: "opportunity",
        title: "Escala Eficiente",
        message: `O portfólio aumentou o investimento em ${spendDelta.toFixed(1)}% e os resultados acompanharam com alto ganho de ${resultsDelta.toFixed(1)}%.`
      });
    } else if (spendDelta > 0 && resultsDelta < 0) {
      insights.push({
        type: "alert",
        title: "Perda de Eficiência Global",
        message: `O investimento subiu ${spendDelta.toFixed(1)}%, mas a geração de resultados caiu ${Math.abs(resultsDelta).toFixed(1)}%. Considere revisar a alocação de verba.`
      });
    } else if (spendDelta < 0 && resultsDelta > 0) {
      insights.push({
        type: "opportunity",
        title: "Otimização de Portfólio",
        message: `Houve economia de ${Math.abs(spendDelta).toFixed(1)}% no investimento e ainda assim os resultados totais cresceram ${resultsDelta.toFixed(1)}%.`
      });
    }
  }

  // 2. Alerta de concentração excessiva
  const sortedBySpend = [...campaigns].sort((a, b) => b.metrics.spend - a.metrics.spend);
  const topSpender = sortedBySpend[0];
  const formatAsBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format;
  
  if (topSpender && globalMetrics.spend > 0) {
    const topSpenderShare = (topSpender.metrics.spend / globalMetrics.spend) * 100;
    if (topSpenderShare >= 70 && campaigns.length > 2) {
      insights.push({
        type: "alert",
        title: "Concentração de Risco",
        message: `A campanha "${topSpender.campaign.name}" concentra ${topSpenderShare.toFixed(1)}% de toda a verba do portfólio. Avalie a diversificação para reduzir dependência.`
      });
    } else if (topSpenderShare >= 40) {
      insights.push({
        type: "info",
        title: "Campanha Protagonista",
        message: `O maior volume de investimento (${topSpenderShare.toFixed(1)}%) está alocado na campanha "${topSpender.campaign.name}".`
      });
    }
  }

  // 3. Distribuição de Objetivos
  if (objectiveDistribution.length > 0) {
    const topObjectiveSpend = [...objectiveDistribution].sort((a, b) => b.spend - a.spend)[0];
    const topObjectiveResults = [...objectiveDistribution].sort((a, b) => b.results - a.results)[0];
    const topObjectiveSpendCategory = topObjectiveSpend?.objectiveCategory as ObjectiveCategory | undefined;
    const topObjectiveResultsCategory = topObjectiveResults?.objectiveCategory as ObjectiveCategory | undefined;

    if (topObjectiveSpend && topObjectiveSpendCategory && topObjectiveSpend.percent >= 80) {
      insights.push({
        type: "info",
        title: "Estratégia Focada",
        message: `Quase todo o orçamento (${topObjectiveSpend.percent.toFixed(1)}%) está direcionado para o objetivo de ${getObjectiveLabel(topObjectiveSpendCategory)}.`
      });
    }

    if (
      topObjectiveSpend &&
      topObjectiveResults &&
      topObjectiveSpendCategory &&
      topObjectiveResultsCategory &&
      topObjectiveSpend.objectiveCategory !== topObjectiveResults.objectiveCategory &&
      topObjectiveResults.results > 0
    ) {
      insights.push({
        type: "opportunity",
        title: "Oportunidade de Alocação",
        message: `A maior parte da verba vai para ${getObjectiveLabel(topObjectiveSpendCategory)} (${formatAsBRL(topObjectiveSpend.spend)}), mas o volume primário de resultados vem de campanhas de ${getObjectiveLabel(topObjectiveResultsCategory)}.`
      });
    }
  }

  // 4. Eficiência de Campanhas (Apenas válidas)
  const validCampaigns = campaigns.filter(c => c.metrics.results > 0 && c.metrics.costPerResult !== null && c.metrics.spend > 0);
  
  if (validCampaigns.length >= 2) {
    // Top Eficiência (menor CPR)
    const sortedByEfficiency = [...validCampaigns].sort((a, b) => a.metrics.costPerResult! - b.metrics.costPerResult!);
    const bestEfficiency = sortedByEfficiency[0];
    const worstEfficiency = sortedByEfficiency[sortedByEfficiency.length - 1];
    
    // Evita comparar campanhas de objetivos diferentes sob o mesmo prisma de "pior" ou "melhor" a menos que sejam do mesmo tipo.
    // Vamos filtrar apenas se comparadas no mesmo objetivo majoritario ou fazer o alerta restrito
    if (bestEfficiency) {
       insights.push({
         type: "info",
         title: "Destaque de Eficiência",
         message: `A campanha "${bestEfficiency.campaign.name}" apresenta o menor custo por resultado (${formatAsBRL(bestEfficiency.metrics.costPerResult!)}) para o objetivo de ${getObjectiveLabel(bestEfficiency.campaign.objectiveCategory)}.`
       });
    }

    // Alerta de custo discrepante (pior CPR vs melhor CPR), mas só se forem do mesmo objetivo para ser justo
    if (bestEfficiency && worstEfficiency && bestEfficiency.campaign.objectiveCategory === worstEfficiency.campaign.objectiveCategory) {
      const discrepancyFactor = worstEfficiency.metrics.costPerResult! / bestEfficiency.metrics.costPerResult!;
      
      if (discrepancyFactor >= 3 && worstEfficiency.metrics.spend > globalMetrics.spend * 0.1) {
        insights.push({
          type: "alert",
          title: "Discrepância de Custo",
          message: `O custo em "${worstEfficiency.campaign.name}" está ${discrepancyFactor.toFixed(1)}x mais caro do que o melhor desempenho na mesma categoria de objetivo.`
        });
      }
    }
  }

  // 5. Alerta de Verba sem Retorno (Gasto alto, 0 conversões)
  const highSpendZeroResults = campaigns.filter(c => c.metrics.results === 0 && c.metrics.spend > globalMetrics.spend * 0.15);
  for (const campaignZero of highSpendZeroResults) {
    insights.push({
      type: "alert",
      title: "Verba sem Resultados",
      message: `A campanha "${campaignZero.campaign.name}" já consumiu ${formatAsBRL(campaignZero.metrics.spend)} sem registrar nenhum resultado válido para seu objetivo.`
    });
  }

  // Limite visual: apenas os 5 top insights para não poluir
  return insights.slice(0, 5);
}
