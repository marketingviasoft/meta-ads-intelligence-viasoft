import { DashboardClient } from "@/components/dashboard-client";
import { getDashboardInitialState, type DashboardSearchParams } from "@/lib/dashboard-query";

export const dynamic = "force-dynamic";

export default async function CampaignDashboardPage({
  searchParams
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const params = await searchParams;
  const initialState = getDashboardInitialState(params);

  return (
    <DashboardClient
      initialVerticalTag={initialState.initialVerticalTag}
      initialDeliveryGroup={initialState.initialDeliveryGroup}
      initialRangeDays={initialState.initialRangeDays}
      initialCampaignId={initialState.initialCampaignId}
    />
  );
}
