import { NextRequest, NextResponse } from "next/server";
import { getVerticalBudgetSummaryFromStore } from "@/lib/meta-insights-store";
import { resolveSupportedVertical, SUPPORTED_VERTICALS } from "@/lib/verticals";

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
    const summary = await getVerticalBudgetSummaryFromStore({
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
    const message =
      error instanceof Error ? error.message : "Erro ao calcular orçamento da vertical";
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
