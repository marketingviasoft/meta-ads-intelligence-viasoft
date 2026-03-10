import { NextRequest, NextResponse } from "next/server";
import { getCampaignCatalogFromStore } from "@/lib/meta-insights-store";
import { parseRangeDays } from "@/utils/date-range";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validateSupabaseEnv(): NextResponse | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();

  if (!supabaseUrl) {
    return NextResponse.json(
      {
        error: "NEXT_PUBLIC_SUPABASE_URL não configurado"
      },
      {
        status: 400
      }
    );
  }

  if (!supabaseKey) {
    return NextResponse.json(
      {
        error: "NEXT_PUBLIC_SUPABASE_ANON_KEY não configurado"
      },
      {
        status: 400
      }
    );
  }

  return null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const envError = validateSupabaseEnv();
  if (envError) {
    return envError;
  }

  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  const rangeDays = parseRangeDays(request.nextUrl.searchParams.get("rangeDays"));

  try {
    const campaigns = await getCampaignCatalogFromStore(rangeDays, refresh);
    return NextResponse.json({
      data: campaigns,
      meta: {
        count: campaigns.length,
        refreshed: refresh,
        rangeDays
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao buscar campanhas no Supabase";
    return NextResponse.json(
      {
        error: message
      },
      {
        status: 500
      }
    );
  }
}
