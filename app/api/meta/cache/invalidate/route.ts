import { NextRequest, NextResponse } from "next/server";
import {
  invalidateAllCache,
  invalidateCampaignRangeCache,
  invalidateCampaignsCache
} from "@/lib/meta-dashboard";
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const envError = validateMetaEnv();
  if (envError) {
    return envError;
  }

  let payload: {
    campaignId?: string;
    rangeDays?: number;
    scope?: "all" | "campaigns" | "performance";
  };

  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const scope = payload.scope ?? "performance";

  if (scope === "all") {
    invalidateAllCache();
    return NextResponse.json({
      ok: true,
      scope,
      message: "Cache total invalidado"
    });
  }

  if (scope === "campaigns") {
    invalidateCampaignsCache();
    return NextResponse.json({
      ok: true,
      scope,
      message: "Cache de campanhas invalidado"
    });
  }

  if (!payload.campaignId || payload.rangeDays === undefined) {
    return NextResponse.json(
      {
        error: "Para scope performance informe campaignId e rangeDays"
      },
      {
        status: 400
      }
    );
  }

  const parsedRangeDays = Number.parseInt(String(payload.rangeDays), 10);

  if (!isValidRangeDays(parsedRangeDays)) {
    return NextResponse.json(
      {
        error: "rangeDays inválido"
      },
      {
        status: 400
      }
    );
  }

  const removedKeys = invalidateCampaignRangeCache(payload.campaignId, parsedRangeDays);

  return NextResponse.json({
    ok: true,
    scope: "performance",
    removedKeys,
    message: "Cache da campanha/período invalidado"
  });
}
