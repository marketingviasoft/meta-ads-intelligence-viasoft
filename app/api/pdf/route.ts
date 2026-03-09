import { NextRequest, NextResponse } from "next/server";
import { generateDashboardPdf } from "@/lib/pdf-generator";
import { PUBLICATION_SLUG } from "@/lib/branding";
import { getActiveCampaigns } from "@/lib/meta-dashboard";
import { resolveSupportedVertical, SUPPORTED_VERTICALS } from "@/lib/verticals";
import { isValidRangeDays } from "@/utils/date-range";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ObjectiveCategory = "TRAFFIC" | "ENGAGEMENT" | "RECOGNITION" | "CONVERSIONS";

function slugifySegment(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mapObjectiveCategoryToSlug(category: ObjectiveCategory | undefined): string {
  switch (category) {
    case "TRAFFIC":
      return "trafego";
    case "ENGAGEMENT":
      return "engajamento";
    case "RECOGNITION":
      return "reconhecimento";
    case "CONVERSIONS":
      return "conversao";
    default:
      return "meta-ads";
  }
}

function formatDateStampBrazil(now: Date): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);

  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";

  return `${year}-${month}-${day}`;
}

function compactAndTrimSlug(segments: string[], maxLength = 150): string {
  const compact = segments.filter(Boolean).join("-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  if (compact.length <= maxLength) {
    return compact;
  }

  return compact.slice(0, maxLength).replace(/-+$/g, "");
}

function parseCampaignSlugParts(params: {
  campaignName: string;
  objectiveCategory?: ObjectiveCategory;
}): { verticalSlug: string; objectiveSlug: string; campaignShortSlug: string } {
  const { campaignName, objectiveCategory } = params;
  const pattern = /^\s*\[[^\]]+\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.*)$/u;
  const match = campaignName.match(pattern);

  const verticalRaw = match?.[1]?.trim() ?? "";
  const objectiveRaw = match?.[2]?.trim() ?? "";
  const tailRaw = match?.[3]?.trim() ?? campaignName;
  const tailWithoutBrackets = tailRaw.replace(/[\[\]]/g, " ").trim();

  const verticalSlug = slugifySegment(verticalRaw || "campanha");
  const objectiveSlug = slugifySegment(objectiveRaw || mapObjectiveCategoryToSlug(objectiveCategory));
  const campaignShortSlug = slugifySegment(tailWithoutBrackets || campaignName || "campanha");

  return {
    verticalSlug: verticalSlug || "campanha",
    objectiveSlug: objectiveSlug || "meta-ads",
    campaignShortSlug: campaignShortSlug || "campanha"
  };
}

async function buildPdfFileName(params: {
  campaignId?: string;
  verticalTag?: string;
  rangeDays: number;
}): Promise<string> {
  const { campaignId, verticalTag, rangeDays } = params;
  const dateStamp = formatDateStampBrazil(new Date());

  if (campaignId) {
    try {
      const campaigns = await getActiveCampaigns(false);
      const campaign = campaigns.find((item) => item.id === campaignId);

      if (!campaign) {
        return `${PUBLICATION_SLUG}-${campaignId}-${rangeDays}d-${dateStamp}.pdf`;
      }

      const { verticalSlug, objectiveSlug, campaignShortSlug } = parseCampaignSlugParts({
        campaignName: campaign.name,
        objectiveCategory: campaign.objectiveCategory
      });

      const slug = compactAndTrimSlug([
        PUBLICATION_SLUG,
        verticalSlug,
        objectiveSlug,
        campaignShortSlug,
        `${rangeDays}d`,
        dateStamp
      ]);

      return `${slug}.pdf`;
    } catch {
      return `${PUBLICATION_SLUG}-${campaignId}-${rangeDays}d-${dateStamp}.pdf`;
    }
  }

  const verticalSlug = slugifySegment(verticalTag ?? "vertical");
  const slug = compactAndTrimSlug([
    PUBLICATION_SLUG,
    verticalSlug,
    "orcamento-vertical",
    `${rangeDays}d`,
    dateStamp
  ]);

  return `${slug}.pdf`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rawCampaignId = request.nextUrl.searchParams.get("campaignId") ?? "";
  const rawVerticalTag = request.nextUrl.searchParams.get("verticalTag") ?? "";
  const rawRangeDays = request.nextUrl.searchParams.get("rangeDays");

  const campaignId = rawCampaignId.trim() || null;
  const parsedVerticalTag = rawVerticalTag.trim() ? resolveSupportedVertical(rawVerticalTag) : null;

  if (!campaignId && !rawVerticalTag.trim()) {
    return NextResponse.json(
      {
        error: "Informe campaignId ou verticalTag"
      },
      {
        status: 400
      }
    );
  }

  if (rawVerticalTag.trim() && !parsedVerticalTag) {
    return NextResponse.json(
      {
        error: `Vertical inválida. Use: ${SUPPORTED_VERTICALS.join(", ")}`
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
    const [pdfData, fileName] = await Promise.all([
      generateDashboardPdf({
        baseUrl,
        campaignId: campaignId ?? undefined,
        verticalTag: parsedVerticalTag ?? undefined,
        rangeDays: parsedRangeDays
      }),
      buildPdfFileName({
        campaignId: campaignId ?? undefined,
        verticalTag: parsedVerticalTag ?? undefined,
        rangeDays: parsedRangeDays
      })
    ]);

    return new NextResponse(pdfData, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
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
