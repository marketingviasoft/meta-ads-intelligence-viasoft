import { NextRequest, NextResponse } from "next/server";
import { getVerticalBudgetSummary } from "@/lib/meta-dashboard";
import { resolveSupportedVertical, SUPPORTED_VERTICALS } from "@/lib/verticals";

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

  const rawVerticalTag = request.nextUrl.searchParams.get("verticalTag") ?? "";
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";

  if (!rawVerticalTag.trim()) {
    return NextResponse.json(
      {
        error: "Parâmetro verticalTag é obrigatório"
      },
      {
        status: 400
      }
    );
  }

  const verticalTag = resolveSupportedVertical(rawVerticalTag);
  if (!verticalTag) {
    return NextResponse.json(
      {
        error: `Vertical inválida. Use: ${SUPPORTED_VERTICALS.join(", ")}`
      },
      {
        status: 400
      }
    );
  }

  try {
    const summary = await getVerticalBudgetSummary({
      verticalTag,
      forceRefresh: refresh
    });

    return NextResponse.json({
      data: summary,
      meta: {
        verticalTag,
        refreshed: refresh
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao calcular orçamento da vertical";
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
