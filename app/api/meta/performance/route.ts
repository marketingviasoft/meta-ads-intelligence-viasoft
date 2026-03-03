import { NextRequest, NextResponse } from "next/server";
import { getDashboardPayload } from "@/lib/meta-dashboard";
import { isValidRangeDays } from "@/utils/date-range";

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

  const campaignId = request.nextUrl.searchParams.get("campaignId");
  const rawRangeDays = request.nextUrl.searchParams.get("rangeDays");
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

  const parsedRangeDays = Number.parseInt(rawRangeDays ?? "7", 10);

  if (!isValidRangeDays(parsedRangeDays)) {
    return NextResponse.json(
      {
        error: "Período inválido. Use 7, 14, 28 ou 30"
      },
      {
        status: 400
      }
    );
  }

  try {
    const payload = await getDashboardPayload({
      campaignId,
      rangeDays: parsedRangeDays,
      forceRefresh: refresh
    });

    return NextResponse.json({
      data: payload
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar performance";
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
