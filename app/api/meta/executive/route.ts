import { NextRequest, NextResponse } from "next/server";
import { getExecutivePayloadFromStore } from "@/lib/meta-insights-store";
import { 
  CAMPAIGN_STATUS_FILTER_ALL, 
  type CampaignStatusFilterValue 
} from "@/lib/dashboard-query";
import { isValidRangeDays } from "@/utils/date-range";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validateSupabaseEnv(): NextResponse | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();

  if (!supabaseUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_SUPABASE_URL não configurado" }, { status: 400 });
  }

  if (!supabaseKey) {
    return NextResponse.json({ error: "NEXT_PUBLIC_SUPABASE_ANON_KEY não configurado" }, { status: 400 });
  }

  return null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const envError = validateSupabaseEnv();
  if (envError) return envError;

  const verticalTag = request.nextUrl.searchParams.get("verticalTag");
  const deliveryGroup = (request.nextUrl.searchParams.get("deliveryGroup") as CampaignStatusFilterValue) || CAMPAIGN_STATUS_FILTER_ALL;
  const rawRangeDays = request.nextUrl.searchParams.get("rangeDays");
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";

  const parsedRangeDays = Number.parseInt(rawRangeDays ?? "7", 10);

  if (!isValidRangeDays(parsedRangeDays)) {
    return NextResponse.json({ error: "Período inválido. Use 7, 14, 28 ou 30" }, { status: 400 });
  }

  try {
    const payload = await getExecutivePayloadFromStore({
      verticalTag,
      deliveryGroup,
      rangeDays: parsedRangeDays,
      forceRefresh: refresh
    });

    return NextResponse.json({ data: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar dados executivos no Supabase";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
