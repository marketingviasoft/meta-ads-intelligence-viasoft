import { NextRequest, NextResponse } from "next/server";
import { getAdAnalytics } from "@/lib/meta-analytics";
import { isValidRangeDays } from "@/utils/date-range";
import type { RangeDays } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const adId = request.nextUrl.searchParams.get("adId");
  const campaignId = request.nextUrl.searchParams.get("campaignId");
  const rawRangeDays = request.nextUrl.searchParams.get("rangeDays");

  if (!adId || !campaignId) {
    return NextResponse.json(
      { error: "Parâmetros adId e campaignId são obrigatórios." },
      { status: 400 }
    );
  }

  const parsedRangeDays = Number.parseInt(rawRangeDays ?? "7", 10);

  if (!isValidRangeDays(parsedRangeDays)) {
    return NextResponse.json(
      { error: "Período inválido." },
      { status: 400 }
    );
  }

  try {
    const data = await getAdAnalytics({
      adId,
      campaignId,
      rangeDays: parsedRangeDays as RangeDays
    });

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido ao carregar analytics.";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
