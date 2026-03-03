import { NextRequest, NextResponse } from "next/server";
import { getAdPreview } from "@/lib/meta-dashboard";

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

  const adId = request.nextUrl.searchParams.get("adId");
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";

  if (!adId) {
    return NextResponse.json(
      {
        error: "Parametro adId e obrigatorio"
      },
      {
        status: 400
      }
    );
  }

  try {
    const preview = await getAdPreview(adId, refresh);
    return NextResponse.json({
      data: preview,
      meta: {
        adId,
        refreshed: refresh
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao carregar preview do anúncio";
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
