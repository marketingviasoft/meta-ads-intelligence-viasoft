import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const GRAPH_API_BASE = "https://graph.facebook.com";
const META_API_VERSION = process.env.META_API_VERSION ?? "v19.0";
const TABLE_NAME = "meta_campaign_insights";
const PAGE_SIZE = 500;
const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 90;
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 1200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", ".").trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function parseRateLimitCode(payload) {
  const code = payload?.error?.code;
  return typeof code === "number" ? code : null;
}

function shouldRetryByStatus(status) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function shouldRetryByMetaCode(code) {
  return code === 4 || code === 17;
}

function buildBackoffDelayMs(attempt) {
  const exponential = RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1);
  const jitter = Math.floor(Math.random() * 400);
  return Math.min(exponential + jitter, 12_000);
}

function formatDateISO(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveTimeRangeLast30Days() {
  const now = new Date();
  const until = formatDateISO(now);
  const sinceDate = new Date(now);
  sinceDate.setUTCDate(now.getUTCDate() - 29);
  const since = formatDateISO(sinceDate);

  return { since, until };
}

function getMetaConfig() {
  const accessToken = process.env.META_ACCESS_TOKEN?.trim();
  const rawAdAccountId = process.env.META_AD_ACCOUNT_ID?.trim();

  if (!accessToken) {
    throw new Error("META_ACCESS_TOKEN não configurado");
  }

  if (!rawAdAccountId) {
    throw new Error("META_AD_ACCOUNT_ID não configurado");
  }

  const adAccountId = rawAdAccountId.startsWith("act_")
    ? rawAdAccountId
    : `act_${rawAdAccountId}`;

  return {
    accessToken,
    adAccountId
  };
}

function buildMetaUrl(path, query = {}) {
  const { accessToken } = getMetaConfig();
  const url = new URL(`${GRAPH_API_BASE}/${META_API_VERSION}/${path}`);

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  url.searchParams.set("access_token", accessToken);
  return url.toString();
}

async function fetchMetaJsonWithRetry(url, init = {}) {
  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        ...init
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const rateCode = parseRateLimitCode(payload);
        const retryable =
          shouldRetryByStatus(response.status) || shouldRetryByMetaCode(rateCode);

        if (retryable && attempt < MAX_RETRY_ATTEMPTS) {
          await sleep(buildBackoffDelayMs(attempt));
          continue;
        }

        const errorMessage =
          payload?.error?.message ??
          payload?.message ??
          `Falha HTTP Meta API: ${response.status}`;
        throw new Error(errorMessage);
      }

      if (payload?.error) {
        const rateCode = parseRateLimitCode(payload);
        if (shouldRetryByMetaCode(rateCode) && attempt < MAX_RETRY_ATTEMPTS) {
          await sleep(buildBackoffDelayMs(attempt));
          continue;
        }

        throw new Error(payload.error.message ?? "Erro desconhecido da Meta API");
      }

      return payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? "");
      const likelyNetworkError =
        message.includes("fetch failed") ||
        message.includes("ECONNRESET") ||
        message.includes("ETIMEDOUT");

      if (likelyNetworkError && attempt < MAX_RETRY_ATTEMPTS) {
        await sleep(buildBackoffDelayMs(attempt));
        continue;
      }

      throw error;
    }
  }

  throw new Error("Meta API indisponível após múltiplas tentativas");
}

async function startAsyncInsightsJob() {
  const { adAccountId } = getMetaConfig();
  const range = resolveTimeRangeLast30Days();
  const fields = [
    "campaign_id",
    "campaign_name",
    "date_start",
    "date_stop",
    "spend",
    "impressions",
    "clicks",
    "actions"
  ].join(",");

  const url = buildMetaUrl(`${adAccountId}/insights`, {
    level: "campaign",
    fields,
    time_increment: "1",
    time_range: JSON.stringify(range),
    limit: "5000",
    async: "true"
  });

  const payload = await fetchMetaJsonWithRetry(url, {
    method: "POST"
  });
  const reportRunId = payload?.report_run_id;

  if (!reportRunId) {
    throw new Error("Não foi possível iniciar o relatório assíncrono da Meta");
  }

  return {
    reportRunId,
    range,
    fields
  };
}

function normalizeAsyncStatus(status) {
  return String(status ?? "")
    .trim()
    .toLowerCase();
}

function isJobCompleted(status) {
  return status === "job completed" || status === "completed";
}

function isJobFailed(status) {
  return (
    status === "job failed" ||
    status === "failed" ||
    status === "job skipped" ||
    status === "skipped"
  );
}

async function waitForJobCompletion(reportRunId) {
  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt += 1) {
    if (attempt > 1) {
      await sleep(POLL_INTERVAL_MS);
    }

    const statusUrl = buildMetaUrl(reportRunId, {
      fields: "async_status,async_percent_completion"
    });
    const statusPayload = await fetchMetaJsonWithRetry(statusUrl);
    const asyncStatus = normalizeAsyncStatus(statusPayload?.async_status);

    if (isJobCompleted(asyncStatus)) {
      return statusPayload;
    }

    if (isJobFailed(asyncStatus)) {
      throw new Error(
        `Job assíncrono da Meta falhou: ${statusPayload?.async_status ?? "status desconhecido"}`
      );
    }
  }

  throw new Error("Timeout aguardando finalização do relatório assíncrono da Meta");
}

async function fetchAllReportInsights(reportRunId, fields) {
  const rows = [];
  let nextUrl = buildMetaUrl(`${reportRunId}/insights`, {
    fields,
    limit: "5000"
  });
  let pageCount = 0;

  while (nextUrl) {
    if (pageCount > 80) {
      throw new Error("Paginação do relatório excedeu o limite de segurança (80 páginas)");
    }

    const payload = await fetchMetaJsonWithRetry(nextUrl);
    rows.push(...(payload?.data ?? []));
    nextUrl = payload?.paging?.next ?? null;
    pageCount += 1;
  }

  return rows;
}

function extractPurchasesOrLeads(actions) {
  if (!Array.isArray(actions)) {
    return 0;
  }

  return actions.reduce((total, item) => {
    const actionType = String(item?.action_type ?? "").toLowerCase();
    const value = toNumber(item?.value);
    const isLeadOrPurchase = actionType.includes("lead") || actionType.includes("purchase");

    return isLeadOrPurchase ? total + value : total;
  }, 0);
}

function normalizeInsightRowsForSupabase(rows) {
  return rows
    .map((row) => {
      const date = String(row?.date_start ?? "").trim();
      const campaignId = String(row?.campaign_id ?? "").trim();
      const campaignName = String(row?.campaign_name ?? "").trim();

      if (!date || !campaignId || !campaignName) {
        return null;
      }

      return {
        date,
        campaign_id: campaignId,
        campaign_name: campaignName,
        spend: toNumber(row?.spend),
        impressions: Math.round(toNumber(row?.impressions)),
        clicks: Math.round(toNumber(row?.clicks)),
        purchases: extractPurchasesOrLeads(row?.actions)
      };
    })
    .filter(Boolean);
}

async function upsertInsightsInBatches(rows) {
  if (rows.length === 0) {
    return 0;
  }

  let total = 0;
  for (let from = 0; from < rows.length; from += PAGE_SIZE) {
    const batch = rows.slice(from, from + PAGE_SIZE);
    const { error } = await supabase
      .from(TABLE_NAME)
      .upsert(batch, { onConflict: "date,campaign_id" });

    if (error) {
      throw new Error(`Supabase upsert falhou: ${error.message}`);
    }

    total += batch.length;
  }

  return total;
}

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return true;
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  const headerSecret = (request.headers.get("x-cron-secret") ?? "").trim();

  return bearer === secret || headerSecret === secret;
}

function validateSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL não configurado");
  }

  if (!supabaseKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY não configurado");
  }
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    validateSupabaseEnv();
    getMetaConfig();

    const { reportRunId, range, fields } = await startAsyncInsightsJob();
    await waitForJobCompletion(reportRunId);
    const reportRows = await fetchAllReportInsights(reportRunId, fields);
    const normalizedRows = normalizeInsightRowsForSupabase(reportRows);
    const upsertedRows = await upsertInsightsInBatches(normalizedRows);

    return NextResponse.json({
      success: true,
      reportRunId,
      syncedRows: upsertedRows,
      fetchedRows: reportRows.length,
      range
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao sincronizar Meta -> Supabase";
    return NextResponse.json(
      {
        success: false,
        error: message
      },
      {
        status: 500
      }
    );
  }
}

