import { NextRequest, NextResponse } from "next/server";
import { getAdSetAds } from "@/lib/meta-dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validateMetaEnv(): NextResponse | null {
  const accessToken = process.env.META_ACCESS_TOKEN?.trim();
  const adAccountId = process.env.META_AD_ACCOUNT_ID?.trim();

  if (!accessToken) {
    return NextResponse.json(
      {
        error: "META_ACCESS_TOKEN não configurado"
      },
      {
        status: 400
      }
    );
  }

  if (!adAccountId) {
    return NextResponse.json(
      {
        error: "META_AD_ACCOUNT_ID não configurado"
      },
      {
        status: 400
      }
    );
  }

  return null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const envError = validateMetaEnv();
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
    const ads = await getAdSetAds(adSetId, refresh);

    return NextResponse.json({
      data: ads,
      meta: {
        adSetId,
        count: ads.length,
        refreshed: refresh
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar anúncios";
    return NextResponse.json(
      {
        error: message
      },
      {
        status: 502
      }
    );
  }
}
