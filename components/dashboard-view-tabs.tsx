"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  buildDashboardHref,
  getDashboardInitialState,
  getFirstQueryValue,
  DASHBOARD_QUERY_KEYS
} from "@/lib/dashboard-query";

const VIEW_TABS = [
  {
    label: "Resumo Executivo",
    pathname: "/dashboard/executivo",
    includeCampaignId: false
  },
  {
    label: "Análise por Campanha",
    pathname: "/dashboard/campanhas",
    includeCampaignId: true
  },
  {
    label: "Sincronizações",
    pathname: "/dashboard/sincronizacoes",
    includeCampaignId: false
  }
] as const;

export function DashboardViewTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sharedState = getDashboardInitialState(searchParams);
  const currentCampaignId = getFirstQueryValue(searchParams.getAll(DASHBOARD_QUERY_KEYS.campaignId));

  return (
    <nav
      aria-label="Visões do dashboard"
      className="surface-panel enter-fade mb-5 flex flex-wrap items-center gap-2 p-2"
    >
      {VIEW_TABS.map((tab) => {
        const isActive = pathname === tab.pathname;
        const href = buildDashboardHref({
          pathname: tab.pathname,
          verticalTag: sharedState.initialVerticalTag,
          deliveryGroup: sharedState.initialDeliveryGroup,
          rangeDays: sharedState.initialRangeDays,
          campaignId: currentCampaignId,
          includeCampaignId: tab.includeCampaignId
        });

        return (
          <Link
            key={tab.pathname}
            href={href}
            className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition ${
              isActive
                ? "bg-viasoft text-white shadow-sm shadow-viasoft/20"
                : "text-slate-600 hover:bg-viasoft/5 hover:text-viasoft"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
