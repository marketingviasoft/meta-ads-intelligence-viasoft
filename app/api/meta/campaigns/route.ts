import { NextRequest, NextResponse } from "next/server";
import { getCampaignCatalog } from "@/lib/meta-dashboard";
import { parseRangeDays } from "@/utils/date-range";

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

  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  const rangeDays = parseRangeDays(request.nextUrl.searchParams.get("rangeDays"));

  try {
    const campaigns = await getCampaignCatalog(rangeDays, refresh);
    return NextResponse.json({
      data: campaigns,
      meta: {
        count: campaigns.length,
        refreshed: refresh,
        rangeDays
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar campanhas";
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
