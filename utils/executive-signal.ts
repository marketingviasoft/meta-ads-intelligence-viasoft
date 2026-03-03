type TrendDirection = "positive" | "negative" | "neutral";

export type ExecutiveAction = "MANTER" | "REVISAR" | "INTERVIR";

export type ExecutiveSignal = {
  action: ExecutiveAction;
  label: "Manter" | "Revisar" | "Intervir";
  reason: string;
  hasMinimumSample: boolean;
};

type ResolveExecutiveSignalParams = {
  direction: TrendDirection;
  resultsDeltaPercent: number | null;
  ctrDeltaPercent: number | null;
  cpcDeltaPercent: number | null;
  costPerResultDeltaPercent: number | null;
  impressions: number;
  clicks: number;
  currentResults: number;
  previousResults: number;
};

const MIN_IMPRESSIONS = 1000;
const MIN_CLICKS = 30;
const MIN_RESULTS = 5;

function asFinite(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function resolveExecutiveSignal(
  params: ResolveExecutiveSignalParams
): ExecutiveSignal {
  const {
    direction,
    resultsDeltaPercent,
    ctrDeltaPercent,
    cpcDeltaPercent,
    costPerResultDeltaPercent,
    impressions,
    clicks,
    currentResults,
    previousResults
  } = params;

  const hasMinimumSample =
    impressions >= MIN_IMPRESSIONS &&
    clicks >= MIN_CLICKS &&
    Math.max(currentResults, previousResults) >= MIN_RESULTS;

  if (!hasMinimumSample) {
    return {
      action: "REVISAR",
      label: "Revisar",
      reason:
        "Amostra ainda limitada para decisão conclusiva. Mantenha monitoramento e revise após novo ciclo.",
      hasMinimumSample
    };
  }

  const resultsDelta = asFinite(resultsDeltaPercent);
  const ctrDelta = asFinite(ctrDeltaPercent);
  const cpcDelta = asFinite(cpcDeltaPercent);
  const costPerResultDelta = asFinite(costPerResultDeltaPercent);

  let score = 0;

  if (resultsDelta <= -20) {
    score -= 3;
  } else if (resultsDelta <= -10) {
    score -= 2;
  } else if (resultsDelta >= 8) {
    score += 2;
  }

  if (ctrDelta <= -8) {
    score -= 2;
  } else if (ctrDelta >= 5) {
    score += 1;
  }

  if (cpcDelta >= 10) {
    score -= 1;
  } else if (cpcDelta <= -8) {
    score += 1;
  }

  if (costPerResultDeltaPercent !== null) {
    if (costPerResultDelta >= 12) {
      score -= 2;
    } else if (costPerResultDelta <= -8) {
      score += 1;
    }
  }

  if (direction === "positive") {
    score += 1;
  } else if (direction === "negative") {
    score -= 1;
  }

  if (score <= -3) {
    return {
      action: "INTERVIR",
      label: "Intervir",
      reason:
        "Queda relevante com sinais de pressão de eficiência. Ação corretiva imediata é recomendada.",
      hasMinimumSample
    };
  }

  if (score >= 2) {
    return {
      action: "MANTER",
      label: "Manter",
      reason:
        "Desempenho consistente com eficiência preservada. Siga com otimização incremental.",
      hasMinimumSample
    };
  }

  return {
    action: "REVISAR",
    label: "Revisar",
    reason:
      "Sinais mistos no comparativo. Ajustes pontuais e monitoramento de curto prazo são recomendados.",
    hasMinimumSample
  };
}
