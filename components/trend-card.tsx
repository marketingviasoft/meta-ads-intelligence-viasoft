"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { ObjectiveCategory } from "@/lib/types";
import { resolveExecutiveSignal } from "@/utils/executive-signal";
import { formatCurrencyBRL, formatSignedPercentBR } from "@/utils/formatters";

type TrendCardProps = {
  direction: "positive" | "negative" | "neutral";
  costPerResult: number | null;
  objectiveCategory: ObjectiveCategory;
  resultsDeltaPercent: number | null;
  ctrDeltaPercent: number | null;
  impressionsDeltaPercent: number | null;
  clicksDeltaPercent: number | null;
  cpcDeltaPercent: number | null;
  costPerResultDeltaPercent: number | null;
  currentImpressions: number;
  currentClicks: number;
  currentResults: number;
  previousResults: number;
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

function getExecutiveActionTone(action: "MANTER" | "REVISAR" | "INTERVIR"): string {
  switch (action) {
    case "MANTER":
      return "border-[#0f766e73] bg-[#0f766e1f] text-[#0f766e]";
    case "INTERVIR":
      return "border-[#b4231873] bg-[#b423181f] text-[#b42318]";
    case "REVISAR":
    default:
      return "border-[#b4530973] bg-[#b453091f] text-[#b45309]";
  }
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
  ctrDeltaPercent,
  impressionsDeltaPercent,
  clicksDeltaPercent,
  cpcDeltaPercent,
  costPerResultDeltaPercent,
  currentImpressions,
  currentClicks,
  currentResults,
  previousResults,
  isPdf = false
}: TrendCardProps) {
  const summaryMessage =
    direction === "positive"
      ? "A campanha melhorou em relação ao período anterior, com boa sustentação de custo."
      : direction === "negative"
        ? "A campanha perdeu desempenho em relação ao período anterior e precisa de ajuste."
        : "A campanha ficou estável em relação ao período anterior.";
  const trendBadge = getTrendBadge(direction);
  const executiveSignal = resolveExecutiveSignal({
    direction,
    resultsDeltaPercent,
    ctrDeltaPercent,
    cpcDeltaPercent,
    costPerResultDeltaPercent,
    impressions: currentImpressions,
    clicks: currentClicks,
    currentResults,
    previousResults
  });

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
  const compact = isPdf;
  const showExtendedNarrative = !isPdf;

  return (
    <article
      className={`surface-panel relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white ${compact ? "p-4" : "p-5"} ${isPdf ? "pdf-block" : ""}`}
    >
      <header className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <TrendDirectionIcon direction={direction} color={trendBadge.iconColor} />
          <h3 className="text-base font-semibold text-viasoft">Tendência consolidada</h3>
        </div>
      </header>

      <p className={`${compact ? "mt-1.5" : "mt-2"} flex items-center gap-2 text-sm font-medium text-slate-700`}>
        <span>Semáforo de ação:</span>
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${getExecutiveActionTone(
            executiveSignal.action
          )}`}
        >
          {executiveSignal.label}
        </span>
      </p>

      <p className={`${compact ? "mt-1.5" : "mt-2"} text-sm text-slate-700`}>{summaryMessage}</p>
      {showExtendedNarrative ? (
        <p className={`${compact ? "mt-1.5" : "mt-2"} text-sm text-slate-700`}>{executiveSignal.reason}</p>
      ) : null}

      <div className={`${compact ? "mt-2.5 p-2.5" : "mt-3 p-3"} rounded-xl border border-slate-200 bg-slate-50/80 text-sm text-slate-700`}>
        <p className="font-medium text-slate-800">Fatores que mais influenciaram o resultado</p>
        <p className="mt-1">
          {primaryDriverLabel}: <span className="font-semibold text-ink">{formatDeltaDriver(primaryDriverValue)}</span>
        </p>
        <p className="mt-1">
          {efficiencyDriverLabel}:{" "}
          <span className="font-semibold text-ink">{formatDeltaDriver(efficiencyDriverValue)}</span>
        </p>
      </div>

      {showExtendedNarrative ? (
        <p className={`${compact ? "mt-2.5" : "mt-3"} text-sm text-slate-700`}>{immediateAction}</p>
      ) : null}

      <p className={`${compact ? "mt-2.5 pt-2.5" : "mt-3 pt-3"} text-sm text-slate-600`}>
        Custo atual para gerar um resultado: <span className="font-semibold text-ink">{formatCurrencyBRL(costPerResult)}</span>
      </p>
    </article>
  );
}
