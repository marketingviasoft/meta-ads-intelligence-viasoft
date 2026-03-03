export type MetricStatus = "healthy" | "warning" | "critical" | "na";

type MetricStatusResult = {
  status: MetricStatus;
  label: string;
};

function resolveStatusLabel(status: MetricStatus): string {
  switch (status) {
    case "healthy":
      return "Saudável";
    case "warning":
      return "Atenção";
    case "critical":
      return "Crítico";
    case "na":
    default:
      return "Sem base";
  }
}

function withLabel(status: MetricStatus): MetricStatusResult {
  return {
    status,
    label: resolveStatusLabel(status)
  };
}

export function getMetricStatus(
  key: string,
  deltaPercent: number | null | undefined,
  inverse = false,
  noPrevData = false
): MetricStatusResult {
  if (noPrevData || deltaPercent === null || deltaPercent === undefined || !Number.isFinite(deltaPercent)) {
    return withLabel("na");
  }

  const metricKey = key.toLowerCase();

  if (metricKey === "spend") {
    const variation = Math.abs(deltaPercent);
    if (variation <= 25) {
      return withLabel("healthy");
    }
    if (variation <= 60) {
      return withLabel("warning");
    }
    return withLabel("critical");
  }

  if (metricKey === "impressions" || metricKey === "clicks" || metricKey === "results") {
    if (deltaPercent < -40) {
      return withLabel("critical");
    }
    if (deltaPercent < -20) {
      return withLabel("warning");
    }
    return withLabel("healthy");
  }

  if (metricKey === "ctr") {
    if (deltaPercent < -20) {
      return withLabel("critical");
    }
    if (deltaPercent < -10) {
      return withLabel("warning");
    }
    return withLabel("healthy");
  }

  if (metricKey === "cpc" || inverse) {
    if (deltaPercent > 20) {
      return withLabel("critical");
    }
    if (deltaPercent > 10) {
      return withLabel("warning");
    }
    return withLabel("healthy");
  }

  return withLabel("healthy");
}
