"use client";

import { AlertTriangle, CheckCircle2, Info, Lightbulb, ListChecks, Sparkles } from "lucide-react";
import type { InsightMessage, Recommendation } from "@/lib/types";

type InsightsPanelProps = {
  insights: InsightMessage[];
  recommendations: Recommendation[];
  isPdf?: boolean;
  fillHeight?: boolean;
};

function getInsightTone(type: InsightMessage["type"]): string {
  switch (type) {
    case "alert":
      return "border border-rose-200 bg-rose-50 text-rose-900";
    case "opportunity":
      return "border border-emerald-200 bg-emerald-50 text-emerald-900";
    case "info":
    default:
      return "border border-slate-200 bg-slate-50 text-slate-900";
  }
}

function getInsightIcon(type: InsightMessage["type"]) {
  switch (type) {
    case "alert":
      return <AlertTriangle size={14} className="mt-0.5 shrink-0 text-rose-700" />;
    case "opportunity":
      return <Sparkles size={14} className="mt-0.5 shrink-0 text-emerald-700" />;
    case "info":
    default:
      return <Info size={14} className="mt-0.5 shrink-0 text-slate-600" />;
  }
}

export function InsightsPanel({
  insights,
  recommendations,
  isPdf = false,
  fillHeight = false
}: InsightsPanelProps) {
  const panelPadding = isPdf ? "p-4" : "p-5";
  const insightsTopSpacing = isPdf ? "mt-2.5" : "mt-3";
  const recommendationTopSpacing = isPdf ? "mt-2.5" : "mt-3";
  const panelStretchClass = fillHeight ? "h-full" : "";

  return (
    <section
      className={`grid ${isPdf ? "gap-3 sm:grid-cols-2 pdf-block" : "gap-4 lg:grid-cols-2"} ${fillHeight ? "h-full items-stretch" : ""}`}
    >
      <div data-dashboard-block="insights" className={`surface-panel ${panelPadding} ${panelStretchClass}`}>
        <h3 className="flex items-center gap-2 text-base font-semibold text-viasoft">
          <Lightbulb size={17} className="text-viasoft" />
          Insights automáticos
        </h3>
        <div className={`${insightsTopSpacing} space-y-2`}>
          {insights.map((insight) => (
            <article
              key={`${insight.type}-${insight.title}`}
              className={`rounded-xl ${isPdf ? "px-2.5 py-1.5" : "px-3 py-2"} ${getInsightTone(insight.type)}`}
            >
              <div className="flex items-start gap-2">
                {getInsightIcon(insight.type)}
                <div>
                  <p className="text-sm font-semibold">{insight.title}</p>
                  <p className="text-sm">{insight.message}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div data-dashboard-block="recommendations" className={`surface-panel ${panelPadding} ${panelStretchClass}`}>
        <h3 className="flex items-center gap-2 text-base font-semibold text-viasoft">
          <ListChecks size={17} className="text-viasoft" />
          Recomendações por objetivo
        </h3>
        <ol className={`${recommendationTopSpacing} ${isPdf ? "space-y-2.5" : "space-y-3"} text-sm text-slate-700`}>
          {recommendations.map((recommendation, index) => (
            <li
              key={recommendation.title}
              className={`rounded-xl border border-slate-200 bg-white ${isPdf ? "avoid-page-break p-2.5" : "p-3"}`}
            >
              <div className="flex items-start gap-2">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-viasoft" />
                <div>
                  <p className="font-semibold text-ink">
                    {index + 1}. {recommendation.title}
                  </p>
                  <p className="mt-1">{recommendation.message}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
