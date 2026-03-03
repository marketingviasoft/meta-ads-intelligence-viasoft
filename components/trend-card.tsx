"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { ObjectiveCategory } from "@/lib/types";
import { formatCurrencyBRL, formatSignedPercentBR } from "@/utils/formatters";

type TrendCardProps = {
  direction: "positive" | "negative" | "neutral";
  costPerResult: number | null;
  objectiveCategory: ObjectiveCategory;
  resultsDeltaPercent: number | null;
  impressionsDeltaPercent: number | null;
  clicksDeltaPercent: number | null;
  cpcDeltaPercent: number | null;
  costPerResultDeltaPercent: number | null;
  isPdf?: boolean;
};

type TrendBadge = {
  iconColor: string;
};

function getTrendBadge(direction: TrendCardProps["direction"]): TrendBadge {
  if (direction === "positive") {
    return {
      iconColor: "#047857"
    };
  }

  if (direction === "negative") {
    return {
      iconColor: "#be123c"
    };
  }

  return {
    iconColor: "#475569"
  };
}

function TrendDirectionIcon({ direction, color }: { direction: TrendCardProps["direction"]; color: string }) {
  if (direction === "positive") {
    return <TrendingUp size={17} style={{ color }} />;
  }

  if (direction === "negative") {
    return <TrendingDown size={17} style={{ color }} />;
  }

  return <Minus size={17} style={{ color }} />;
}

function getTrendSituationLabel(direction: TrendCardProps["direction"]): string {
  if (direction === "positive") {
    return "Em evolução";
  }

  if (direction === "negative") {
    return "Atenção necessária";
  }

  return "Estável";
}

function formatDeltaDriver(value: number | null): string {
  return value !== null && Number.isFinite(value) ? formatSignedPercentBR(value, 1) : "Sem comparação";
}

function getPrimaryDriverLabel(category: ObjectiveCategory): string {
  switch (category) {
    case "TRAFFIC":
      return "Pessoas que clicaram no anúncio";
    case "RECOGNITION":
      return "Pessoas que visualizaram o anúncio";
    case "ENGAGEMENT":
      return "Pessoas que interagiram com o anúncio";
    case "CONVERSIONS":
      return "Resultados alcançados";
    default:
      return "Resultados alcançados";
  }
}

function getImmediateAction(direction: TrendCardProps["direction"]): string {
  if (direction === "positive") {
    return "Próximo passo: manter o que está funcionando e ampliar investimento de forma gradual nos melhores anúncios.";
  }

  if (direction === "negative") {
    return "Próximo passo: revisar público e criativos para recuperar desempenho antes de ampliar investimento.";
  }

  return "Próximo passo: manter a base atual e testar uma nova variação de criativo para buscar ganho incremental.";
}

export function TrendCard({
  direction,
  costPerResult,
  objectiveCategory,
  resultsDeltaPercent,
  impressionsDeltaPercent,
  clicksDeltaPercent,
  cpcDeltaPercent,
  costPerResultDeltaPercent,
  isPdf = false
}: TrendCardProps) {
  const summaryMessage =
    direction === "positive"
      ? "A campanha melhorou em relação ao período anterior, com boa sustentação de custo."
      : direction === "negative"
        ? "A campanha perdeu desempenho em relação ao período anterior e precisa de ajuste."
        : "A campanha ficou estável em relação ao período anterior.";
  const trendBadge = getTrendBadge(direction);
  const situationLabel = getTrendSituationLabel(direction);

  const primaryDriverValue =
    objectiveCategory === "TRAFFIC"
      ? clicksDeltaPercent
      : objectiveCategory === "RECOGNITION"
        ? impressionsDeltaPercent
        : resultsDeltaPercent;

  const efficiencyDriverValue =
    costPerResultDeltaPercent !== null && Number.isFinite(costPerResultDeltaPercent)
      ? costPerResultDeltaPercent
      : cpcDeltaPercent;

  const primaryDriverLabel = getPrimaryDriverLabel(objectiveCategory);
  const efficiencyDriverLabel =
    costPerResultDeltaPercent !== null && Number.isFinite(costPerResultDeltaPercent)
      ? "Custo para gerar resultado"
      : "Custo por clique";
  const immediateAction = getImmediateAction(direction);

  return (
    <article className={`hover-lift relative overflow-hidden rounded-xl bg-white p-5 shadow-sm ${isPdf ? "pdf-block" : ""}`}>
      <header className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <TrendDirectionIcon direction={direction} color={trendBadge.iconColor} />
          <h3 className="text-base font-semibold text-viasoft">Tendência consolidada</h3>
        </div>
      </header>

      <p className="mt-2 text-sm font-medium text-slate-700">
        Situação geral da campanha: <span className="text-ink">{situationLabel}</span>
      </p>

      <p className="mt-2 text-sm text-slate-700">{summaryMessage}</p>

      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-700">
        <p className="font-medium text-slate-800">Fatores que mais influenciaram o resultado</p>
        <p className="mt-1">
          {primaryDriverLabel}: <span className="font-semibold text-ink">{formatDeltaDriver(primaryDriverValue)}</span>
        </p>
        <p className="mt-1">
          {efficiencyDriverLabel}:{" "}
          <span className="font-semibold text-ink">{formatDeltaDriver(efficiencyDriverValue)}</span>
        </p>
      </div>

      <p className="mt-3 text-sm text-slate-700">{immediateAction}</p>

      <p className="mt-3 pt-3 text-sm text-slate-600">
        Custo atual para gerar um resultado: <span className="font-semibold text-ink">{formatCurrencyBRL(costPerResult)}</span>
      </p>
    </article>
  );
}
