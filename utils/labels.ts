import type { DashboardPayload } from "@/lib/types";

export function getObjectiveLabel(category: DashboardPayload["campaign"]["objectiveCategory"]): string {
  switch (category) {
    case "TRAFFIC":
      return "Tráfego";
    case "ENGAGEMENT":
      return "Engajamento";
    case "RECOGNITION":
      return "Reconhecimento";
    case "CONVERSIONS":
      return "Conversão";
    default:
      return "Campanha";
  }
}

export function getDeliveryStatusLabel(status: DashboardPayload["campaign"]["deliveryGroup"] | string): string {
  switch (status) {
    case "ACTIVE":
      return "Ativa";
    case "PAUSED":
      return "Pausada";
    case "WITH_ISSUES":
      return "Com problemas";
    case "PENDING_REVIEW":
      return "Em análise";
    case "ARCHIVED":
      return "Arquivada";
    default:
      return status;
  }
}
