import { NextRequest, NextResponse } from "next/server";
import { getStructureComparisonPayloadFromStore } from "@/lib/meta-insights-store";
import type { StructureComparisonEntityType } from "@/lib/types";
import { isValidRangeDays } from "@/utils/date-range";

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

function parseEntityType(raw: string | null): StructureComparisonEntityType | null {
  if (raw === "ADSET" || raw === "AD") {
    return raw;
  }

  return null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const envError = validateSupabaseEnv();
  if (envError) {
    return envError;
  }

  const campaignId = request.nextUrl.searchParams.get("campaignId");
  const rawEntityType = request.nextUrl.searchParams.get("entityType");
  const rawEntityIds = request.nextUrl.searchParams.get("entityIds");
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

  const entityType = parseEntityType(rawEntityType);
  if (!entityType) {
    return NextResponse.json(
      {
        error: "Parametro entityType inválido. Use ADSET ou AD."
      },
      {
        status: 400
      }
    );
  }

  const entityIds = (rawEntityIds ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (entityIds.length !== 2) {
    return NextResponse.json(
      {
        error: "Selecione exatamente 2 itens para comparação."
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
    const payload = await getStructureComparisonPayloadFromStore({
      campaignId,
      entityType,
      entityIds,
      rangeDays: parsedRangeDays,
      forceRefresh: refresh
    });

    return NextResponse.json({
      data: payload
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao comparar estrutura";
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
