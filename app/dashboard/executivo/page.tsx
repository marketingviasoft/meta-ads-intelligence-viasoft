import { ExecutiveDashboardClient } from "@/components/executive-dashboard-client";
import { getDashboardInitialState, type DashboardSearchParams } from "@/lib/dashboard-query";

export const dynamic = "force-dynamic";

export default async function ExecutiveDashboardPage({
  searchParams
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const params = await searchParams;
  const initialState = getDashboardInitialState(params);

  return (
    <ExecutiveDashboardClient
      initialVerticalTag={initialState.initialVerticalTag}
      initialDeliveryGroup={initialState.initialDeliveryGroup}
      initialRangeDays={initialState.initialRangeDays}
    />
  );
}
