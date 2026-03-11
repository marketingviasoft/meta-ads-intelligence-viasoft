import { NextRequest, NextResponse } from "next/server";
import { getCampaignAdSetsFromStore } from "@/lib/meta-insights-store";

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

  const campaignId = request.nextUrl.searchParams.get("campaignId");
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";

  if (!campaignId) {
    return NextResponse.json(
      {
        error: "Parametro campaignId e obrigatorio"
      },
      {
        status: 400
      }
    );
  }

  try {
    const adSets = await getCampaignAdSetsFromStore(campaignId, refresh);

    return NextResponse.json({
      data: adSets,
      meta: {
        campaignId,
        count: adSets.length,
        refreshed: refresh
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao buscar grupos de anúncios no Supabase";
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
