import { NextRequest, NextResponse } from "next/server";
import { generateDashboardPdf } from "@/lib/pdf-generator";
import { isValidRangeDays } from "@/utils/date-range";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const campaignId = request.nextUrl.searchParams.get("campaignId");
  const rawRangeDays = request.nextUrl.searchParams.get("rangeDays");

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

  const baseUrl = process.env.APP_BASE_URL ?? request.nextUrl.origin;

  try {
    const pdfData = await generateDashboardPdf({
      baseUrl,
      campaignId,
      rangeDays: parsedRangeDays
    });

    return new NextResponse(pdfData, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="meta-dashboard-${campaignId}-${parsedRangeDays}d.pdf"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar PDF";

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
