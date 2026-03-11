import { NextRequest, NextResponse } from "next/server";
import { getAdSetAdsFromStore } from "@/lib/meta-insights-store";

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

  const adSetId = request.nextUrl.searchParams.get("adSetId");
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";

  if (!adSetId) {
    return NextResponse.json(
      {
        error: "Parametro adSetId e obrigatorio"
      },
      {
        status: 400
      }
    );
  }

  try {
    const ads = await getAdSetAdsFromStore(adSetId, refresh);

    return NextResponse.json({
      data: ads,
      meta: {
        adSetId,
        count: ads.length,
        refreshed: refresh
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar anúncios no Supabase";
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
