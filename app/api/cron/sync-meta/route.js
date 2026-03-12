import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const GRAPH_API_BASE = "https://graph.facebook.com";
const META_API_VERSION = process.env.META_API_VERSION ?? "v19.0";

const INSIGHTS_TABLE_NAME = "meta_campaign_insights";
const ADSETS_TABLE_NAME = "meta_adsets";
const ADS_TABLE_NAME = "meta_ads";

const PAGE_SIZE = 500;
const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 90;
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 1200;

const INSIGHT_FIELDS = [
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "ad_id",
  "ad_name",
  "date_start",
  "date_stop",
  "spend",
  "impressions",
  "clicks",
  "reach",
  "frequency",
  "ctr",
  "cpc",
  "cpm",
  "cpp",
  "unique_clicks",
  "conversions",
  "quality_ranking",
  "engagement_rate_ranking",
  "conversion_rate_ranking",
  "actions",
  "cost_per_action_type"
].join(",");

const CAMPAIGN_METADATA_FIELDS =
  "id,name,objective,effective_status,status,configured_status";
const ADSET_METADATA_FIELDS = "id,campaign_id,name,effective_status,status,configured_status";
const AD_METADATA_FIELDS = [
  "id",
  "name",
  "campaign_id",
  "adset_id",
  "destination_type",
  "promoted_object",
  "call_to_action_type",
  "effective_status",
  "status",
  "configured_status",
  "creative{id,name,call_to_action_type,thumbnail_url,image_url,link_url,object_url,template_url,object_story_id,effective_object_story_id,instagram_permalink_url,object_story_spec{link_data{link,call_to_action{value{link}},child_attachments{link,call_to_action{value{link}}}},photo_data{link,url,call_to_action{value{link}}},template_data{link,call_to_action{value{link}}},video_data{link,call_to_action{value{link}}}},asset_feed_spec{link_urls}}"
].join(",");

const AD_METADATA_FIELDS_FALLBACK = [
  "id",
  "name",
  "campaign_id",
  "adset_id",
  "destination_type",
  "promoted_object",
  "call_to_action_type",
  "effective_status",
  "status",
  "configured_status",
  "creative{id,name,call_to_action_type,thumbnail_url,image_url,link_url,object_url,object_story_id,effective_object_story_id,instagram_permalink_url,object_story_spec{link_data{link,call_to_action{value{link}},child_attachments{link,call_to_action{value{link}}}},photo_data{link,url,call_to_action{value{link}}},video_data{link,call_to_action{value{link}}}},asset_feed_spec{link_urls}}"
].join(",");

const AUTO_GENERATED_CREATIVE_SUFFIX_PATTERN = /\s+\d{4}-\d{2}-\d{2}-[a-f0-9]{16,}$/i;

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

function normalizeStatus(value) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();

  return normalized || "UNKNOWN";
}

function normalizeCreativeName(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return "";
  }

  return normalized.replace(AUTO_GENERATED_CREATIVE_SUFFIX_PATTERN, "").trim();
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

function parseIsoDate(isoDate) {
  const [year, month, day] = String(isoDate).split("-").map((value) => Number.parseInt(value, 10));
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

function addDaysToIsoDate(isoDate, days) {
  const date = parseIsoDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateISO(date);
}

function getInclusiveDaysInRange(range) {
  const since = parseIsoDate(range.since);
  const until = parseIsoDate(range.until);
  const diffMs = until.getTime() - since.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
}

function splitTimeRange(range) {
  const totalDays = getInclusiveDaysInRange(range);
  if (totalDays <= 1) {
    return [range];
  }

  const leftDays = Math.floor(totalDays / 2);
  const leftUntil = addDaysToIsoDate(range.since, leftDays - 1);
  const rightSince = addDaysToIsoDate(leftUntil, 1);

  return [
    {
      since: range.since,
      until: leftUntil
    },
    {
      since: rightSince,
      until: range.until
    }
  ];
}

function isMetaReduceDataError(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  return (
    normalized.includes("please reduce the amount of data") ||
    normalized.includes("reduce the amount of data") ||
    normalized.includes("reduce amount of data")
  );
}

function isMetaInvalidFieldError(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  return normalized.includes("tried accessing nonexisting field");
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

async function fetchMetaList(path, query) {
  const rows = [];
  let nextUrl = buildMetaUrl(path, query);
  let pageCount = 0;

  while (nextUrl) {
    if (pageCount > 80) {
      throw new Error("Paginação da Meta excedeu o limite de segurança (80 páginas)");
    }

    const payload = await fetchMetaJsonWithRetry(nextUrl);
    rows.push(...(payload?.data ?? []));
    nextUrl = payload?.paging?.next ?? null;
    pageCount += 1;
  }

  return rows;
}

function chunkArray(values, chunkSize) {
  if (chunkSize <= 0) {
    return [values];
  }

  const chunks = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}

async function fetchMetaEntitiesByIdChunk(params) {
  const { path, fields, ids } = params;
  if (ids.length === 0) {
    return [];
  }

  try {
    return await fetchMetaList(path, {
      fields,
      limit: "5000",
      filtering: JSON.stringify([
        {
          field: "id",
          operator: "IN",
          value: ids
        }
      ])
    });
  } catch (error) {
    if (!isMetaReduceDataError(error) || ids.length <= 1) {
      throw error;
    }

    const splitIndex = Math.ceil(ids.length / 2);
    const left = await fetchMetaEntitiesByIdChunk({
      path,
      fields,
      ids: ids.slice(0, splitIndex)
    });
    const right = await fetchMetaEntitiesByIdChunk({
      path,
      fields,
      ids: ids.slice(splitIndex)
    });

    return [...left, ...right];
  }
}

async function fetchMetaEntitiesByIds(params) {
  const { path, fields, ids } = params;
  const uniqueIds = [...new Set(ids.map((id) => String(id ?? "").trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return [];
  }

  const chunks = chunkArray(uniqueIds, 150);
  const rows = [];

  for (const idsChunk of chunks) {
    const chunkRows = await fetchMetaEntitiesByIdChunk({
      path,
      fields,
      ids: idsChunk
    });
    rows.push(...chunkRows);
  }

  return rows;
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

async function startAsyncInsightsJob(range) {
  const { adAccountId } = getMetaConfig();

  const url = buildMetaUrl(`${adAccountId}/insights`, {
    level: "ad",
    fields: INSIGHT_FIELDS,
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

  return reportRunId;
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

async function fetchAllReportInsights(reportRunId) {
  return fetchMetaList(`${reportRunId}/insights`, {
    fields: INSIGHT_FIELDS,
    limit: "5000"
  });
}

async function fetchInsightsForRangeWithAdaptiveSplit(range, depth = 0) {
  try {
    const reportRunId = await startAsyncInsightsJob(range);
    await waitForJobCompletion(reportRunId);
    const rows = await fetchAllReportInsights(reportRunId);

    return {
      rows,
      jobs: 1
    };
  } catch (error) {
    if (!isMetaReduceDataError(error)) {
      throw error;
    }

    const totalDays = getInclusiveDaysInRange(range);
    if (totalDays <= 1) {
      const baseMessage =
        error instanceof Error ? error.message : "Meta API recusou a consulta para 1 dia";
      throw new Error(`${baseMessage}. Nem mesmo uma janela diária foi aceita.`);
    }

    const [leftRange, rightRange] = splitTimeRange(range);
    const left = await fetchInsightsForRangeWithAdaptiveSplit(leftRange, depth + 1);
    const right = await fetchInsightsForRangeWithAdaptiveSplit(rightRange, depth + 1);

    return {
      rows: [...left.rows, ...right.rows],
      jobs: left.jobs + right.jobs
    };
  }
}

function parseActionMap(raw) {
  if (!Array.isArray(raw)) {
    return {};
  }

  return raw.reduce((accumulator, item) => {
    const actionType = String(item?.action_type ?? "").trim();
    if (!actionType) {
      return accumulator;
    }

    accumulator[actionType] = toNumber(item?.value);
    return accumulator;
  }, {});
}

function readActionMetric(actionMap, actionType) {
  return toNumber(actionMap[actionType]);
}

function sumActionMetricsByHints(actionMap, hints) {
  return Object.entries(actionMap).reduce((total, [actionType, value]) => {
    const normalizedActionType = actionType.toLowerCase();
    const matched = hints.some((hint) => normalizedActionType.includes(hint));
    return matched ? total + toNumber(value) : total;
  }, 0);
}

function resolveCostPerResult(params) {
  const {
    spend,
    conversions,
    purchases,
    leads,
    linkClicks,
    postEngagement
  } = params;

  if (conversions > 0) {
    return spend / conversions;
  }

  const leadOrPurchase = purchases + leads;
  if (leadOrPurchase > 0) {
    return spend / leadOrPurchase;
  }

  if (linkClicks > 0) {
    return spend / linkClicks;
  }

  if (postEngagement > 0) {
    return spend / postEngagement;
  }

  return null;
}

function resolveCreativeThumb(creative) {
  return (
    String(creative?.thumbnail_url ?? "").trim() ||
    String(creative?.image_url ?? "").trim() ||
    null
  );
}

function resolveCreativeName(params) {
  const { creative, adName, adId } = params;
  const creativeName = normalizeCreativeName(creative?.name);
  if (creativeName) {
    return creativeName;
  }

  const normalizedAdName = String(adName ?? "").trim();
  if (normalizedAdName) {
    return normalizedAdName;
  }

  const creativeId = String(creative?.id ?? "").trim();
  if (creativeId) {
    return `Criativo ${creativeId}`;
  }

  const normalizedAdId = String(adId ?? "").trim();
  if (normalizedAdId) {
    return `Criativo ${normalizedAdId}`;
  }

  return "Criativo não identificado";
}

function toNonEmptyString(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function extractCallToActionLink(callToAction) {
  return toNonEmptyString(callToAction?.value?.link);
}

function extractLinkFromChildAttachments(childAttachments) {
  if (!Array.isArray(childAttachments)) {
    return null;
  }

  for (const attachment of childAttachments) {
    const linkFromAttachment =
      toNonEmptyString(attachment?.link) ||
      extractCallToActionLink(attachment?.call_to_action);
    if (linkFromAttachment) {
      return linkFromAttachment;
    }
  }

  return null;
}

function extractLinkFromAssetFeedSpec(assetFeedSpec) {
  if (!assetFeedSpec || !Array.isArray(assetFeedSpec.link_urls)) {
    return null;
  }

  for (const item of assetFeedSpec.link_urls) {
    const linkCandidate =
      toNonEmptyString(item?.website_url) ||
      toNonEmptyString(item?.url) ||
      toNonEmptyString(item?.deeplink_url);
    if (linkCandidate) {
      return linkCandidate;
    }
  }

  return null;
}

function resolveCreativeLink(params) {
  const { creative, promotedObject } = params;
  const objectStorySpec = creative?.object_story_spec;

  const storyLink =
    toNonEmptyString(objectStorySpec?.link_data?.link) ||
    extractCallToActionLink(objectStorySpec?.link_data?.call_to_action) ||
    extractLinkFromChildAttachments(objectStorySpec?.link_data?.child_attachments) ||
    toNonEmptyString(objectStorySpec?.photo_data?.link) ||
    toNonEmptyString(objectStorySpec?.photo_data?.url) ||
    extractCallToActionLink(objectStorySpec?.photo_data?.call_to_action) ||
    toNonEmptyString(objectStorySpec?.template_data?.link) ||
    extractCallToActionLink(objectStorySpec?.template_data?.call_to_action) ||
    toNonEmptyString(objectStorySpec?.video_data?.link) ||
    extractCallToActionLink(objectStorySpec?.video_data?.call_to_action);

  const feedLink = extractLinkFromAssetFeedSpec(creative?.asset_feed_spec);

  return (
    toNonEmptyString(promotedObject?.website_url) ||
    toNonEmptyString(promotedObject?.link) ||
    toNonEmptyString(promotedObject?.custom_url) ||
    toNonEmptyString(promotedObject?.object_store_url) ||
    toNonEmptyString(creative?.link_url) ||
    toNonEmptyString(creative?.template_url) ||
    toNonEmptyString(creative?.object_url) ||
    toNonEmptyString(creative?.instagram_permalink_url) ||
    storyLink ||
    feedLink ||
    null
  );
}

function resolveDestinationFallbackLabel(params) {
  const signal = [
    String(params?.creative?.call_to_action_type ?? "").toUpperCase(),
    String(params?.adCallToActionType ?? "").toUpperCase(),
    String(params?.adDestinationType ?? "").toUpperCase(),
    String(params?.promotedObject?.whatsapp_number ?? "").toUpperCase(),
    String(params?.promotedObject?.whatsapp_phone_number ?? "").toUpperCase()
  ].join(" ");

  if (signal.includes("WHATSAPP")) {
    return "WhatsApp";
  }

  if (signal.includes("MESSENGER")) {
    return "Messenger (destino não identificado)";
  }

  return "Site configurado na Meta Ads (URL não exposta pela API)";
}

function extractBestExternalUrl(candidates) {
  const normalizedCandidates = candidates
    .map((candidate) => toNonEmptyString(candidate))
    .filter(Boolean);

  if (normalizedCandidates.length === 0) {
    return null;
  }

  const externalCandidate = normalizedCandidates.find((candidate) => {
    const lowered = candidate.toLowerCase();
    return (
      lowered.startsWith("http://") ||
      lowered.startsWith("https://")
    ) && !lowered.includes("facebook.com") && !lowered.includes("instagram.com");
  });

  if (externalCandidate) {
    return externalCandidate;
  }

  return normalizedCandidates.find((candidate) => {
    const lowered = candidate.toLowerCase();
    return lowered.startsWith("http://") || lowered.startsWith("https://");
  }) ?? null;
}

function extractUrlFromStoryAttachments(attachments) {
  if (!Array.isArray(attachments)) {
    return null;
  }

  const candidates = [];
  for (const attachment of attachments) {
    candidates.push(attachment?.unshimmed_url);
    candidates.push(attachment?.url);
    candidates.push(attachment?.target?.url);

    if (Array.isArray(attachment?.subattachments?.data)) {
      for (const subattachment of attachment.subattachments.data) {
        candidates.push(subattachment?.unshimmed_url);
        candidates.push(subattachment?.url);
        candidates.push(subattachment?.target?.url);
      }
    }
  }

  return extractBestExternalUrl(candidates);
}

async function fetchStoryDestinationLink(storyId) {
  const normalizedStoryId = String(storyId ?? "").trim();
  if (!normalizedStoryId) {
    return null;
  }

  try {
    const payload = await fetchMetaJsonWithRetry(
      buildMetaUrl(normalizedStoryId, {
        fields: "permalink_url,attachments{target,url,unshimmed_url,subattachments{target,url,unshimmed_url}}"
      })
    );

    const attachmentsUrl = extractUrlFromStoryAttachments(payload?.attachments?.data ?? []);
    if (attachmentsUrl) {
      return attachmentsUrl;
    }

    return extractBestExternalUrl([payload?.permalink_url]);
  } catch {
    return null;
  }
}

async function fetchCampaignMetadataMapByIds(campaignIds) {
  const { adAccountId } = getMetaConfig();
  const items = await fetchMetaEntitiesByIds({
    path: `${adAccountId}/campaigns`,
    fields: CAMPAIGN_METADATA_FIELDS,
    ids: campaignIds
  });

  const byCampaignId = new Map();
  for (const item of items) {
    const campaignId = String(item?.id ?? "").trim();
    if (!campaignId) {
      continue;
    }

    byCampaignId.set(campaignId, {
      objective: String(item?.objective ?? "").trim() || null,
      effectiveStatus: normalizeStatus(item?.effective_status),
      configuredStatus: normalizeStatus(item?.status ?? item?.configured_status)
    });
  }

  return byCampaignId;
}

async function fetchAdSetMetadataMapByIds(adSetIds) {
  const { adAccountId } = getMetaConfig();
  const items = await fetchMetaEntitiesByIds({
    path: `${adAccountId}/adsets`,
    fields: ADSET_METADATA_FIELDS,
    ids: adSetIds
  });

  const byAdSetId = new Map();
  for (const item of items) {
    const adSetId = String(item?.id ?? "").trim();
    if (!adSetId) {
      continue;
    }

    byAdSetId.set(adSetId, {
      campaignId: String(item?.campaign_id ?? "").trim(),
      name: String(item?.name ?? "").trim() || `AdSet ${adSetId}`,
      status: normalizeStatus(item?.effective_status ?? item?.status ?? item?.configured_status)
    });
  }

  return byAdSetId;
}

async function fetchAdMetadataMapByIds(adIds) {
  const { adAccountId } = getMetaConfig();
  let items;
  try {
    items = await fetchMetaEntitiesByIds({
      path: `${adAccountId}/ads`,
      fields: AD_METADATA_FIELDS,
      ids: adIds
    });
  } catch (error) {
    if (!isMetaInvalidFieldError(error)) {
      throw error;
    }

    items = await fetchMetaEntitiesByIds({
      path: `${adAccountId}/ads`,
      fields: AD_METADATA_FIELDS_FALLBACK,
      ids: adIds
    });
  }

  const byAdId = new Map();
  const storyDestinationById = new Map();
  for (const item of items) {
    const adId = String(item?.id ?? "").trim();
    if (!adId) {
      continue;
    }

    const creative = item?.creative ?? null;
    const storyId =
      String(creative?.effective_object_story_id ?? "").trim() ||
      String(creative?.object_story_id ?? "").trim() ||
      null;
    let creativeLink = resolveCreativeLink({
      creative,
      promotedObject: item?.promoted_object
    });

    if (!creativeLink && storyId) {
      let storyLink = null;
      if (storyDestinationById.has(storyId)) {
        storyLink = storyDestinationById.get(storyId) ?? null;
      } else {
        storyLink = await fetchStoryDestinationLink(storyId);
        storyDestinationById.set(storyId, storyLink ?? null);
      }

      if (storyLink) {
        creativeLink = storyLink;
      }
    }

    byAdId.set(adId, {
      campaignId: String(item?.campaign_id ?? "").trim(),
      adSetId: String(item?.adset_id ?? "").trim(),
      name: String(item?.name ?? "").trim() || `Ad ${adId}`,
      status: normalizeStatus(item?.effective_status ?? item?.status ?? item?.configured_status),
      creativeName: resolveCreativeName({
        creative,
        adName: item?.name,
        adId
      }),
      creativeThumb: resolveCreativeThumb(creative),
      creativeLink:
        creativeLink ||
        resolveDestinationFallbackLabel({
          creative,
          adCallToActionType: item?.call_to_action_type,
          adDestinationType: item?.destination_type,
          promotedObject: item?.promoted_object
        })
    });
  }

  return byAdId;
}

function normalizeInsightRowsForSupabase(
  rows,
  campaignMetadataByCampaignId,
  adSetMetadataById,
  adMetadataById
) {
  const nowIso = new Date().toISOString();
  const insightRows = [];
  const adSetsById = new Map();
  const adsById = new Map();

  for (const row of rows) {
    const date = String(row?.date_start ?? "").trim();
    const dateStop = String(row?.date_stop ?? "").trim() || date;
    const campaignId = String(row?.campaign_id ?? "").trim();
    const campaignName = String(row?.campaign_name ?? "").trim();
    const adSetId = String(row?.adset_id ?? "").trim();
    const adSetNameFromInsight = String(row?.adset_name ?? "").trim();
    const adId = String(row?.ad_id ?? "").trim();
    const adNameFromInsight = String(row?.ad_name ?? "").trim();

    if (!date || !campaignId || !campaignName) {
      continue;
    }

    const campaignMetadata = campaignMetadataByCampaignId.get(campaignId);
    const adSetMetadata = adSetMetadataById.get(adSetId);
    const adMetadata = adMetadataById.get(adId);

    const adSetName = adSetNameFromInsight || adSetMetadata?.name || null;
    const adName = adNameFromInsight || adMetadata?.name || null;

    const actions = parseActionMap(row?.actions);
    const costPerActionType = parseActionMap(row?.cost_per_action_type);
    const purchases = sumActionMetricsByHints(actions, ["purchase"]);
    const leads = sumActionMetricsByHints(actions, ["lead"]);
    const linkClicks = readActionMetric(actions, "link_click");
    const postEngagement = readActionMetric(actions, "post_engagement");
    const inlineLinkClicks =
      readActionMetric(actions, "inline_link_click") ||
      sumActionMetricsByHints(actions, ["inline_link_click"]);
    const outboundClicks =
      readActionMetric(actions, "outbound_click") ||
      sumActionMetricsByHints(actions, ["outbound_click"]);
    const spend = toNumber(row?.spend);
    const impressions = Math.round(toNumber(row?.impressions));
    const clicks = Math.round(toNumber(row?.clicks));
    const conversionsRaw = toNumber(row?.conversions);
    const conversions = conversionsRaw > 0 ? conversionsRaw : purchases + leads;
    const costPerResult = resolveCostPerResult({
      spend,
      conversions,
      purchases,
      leads,
      linkClicks,
      postEngagement
    });

    insightRows.push({
      date,
      date_stop: dateStop,
      campaign_id: campaignId,
      campaign_name: campaignName,
      adset_id: adSetId || "",
      adset_name: adSetName,
      ad_id: adId || "",
      ad_name: adName,
      objective: campaignMetadata?.objective ?? null,
      effective_status: campaignMetadata?.effectiveStatus ?? "UNKNOWN",
      configured_status: campaignMetadata?.configuredStatus ?? "UNKNOWN",
      delivery_status: impressions > 0 || spend > 0 ? "ACTIVE" : "WITHOUT_DELIVERY",
      spend,
      impressions,
      clicks,
      reach: Math.round(toNumber(row?.reach)),
      frequency: toNumber(row?.frequency),
      ctr: toNumber(row?.ctr),
      cpc: toNumber(row?.cpc),
      cpm: toNumber(row?.cpm),
      cpp: toNumber(row?.cpp),
      unique_clicks: Math.round(toNumber(row?.unique_clicks)),
      inline_link_clicks: Math.round(inlineLinkClicks),
      outbound_clicks: Math.round(outboundClicks),
      conversions,
      purchases,
      leads,
      link_clicks: linkClicks,
      post_engagement: postEngagement,
      cost_per_result: costPerResult,
      quality_ranking: String(row?.quality_ranking ?? "").trim() || null,
      engagement_rate_ranking: String(row?.engagement_rate_ranking ?? "").trim() || null,
      conversion_rate_ranking: String(row?.conversion_rate_ranking ?? "").trim() || null,
      actions,
      cost_per_action_type: costPerActionType,
      updated_at: nowIso
    });

    if (adSetId) {
      adSetsById.set(adSetId, {
        id: adSetId,
        campaign_id: campaignId || adSetMetadata?.campaignId || "",
        name: adSetName || `AdSet ${adSetId}`,
        status: adSetMetadata?.status ?? "UNKNOWN",
        updated_at: nowIso
      });
    }

    if (adId) {
      const resolvedAdSetId = adSetId || adMetadata?.adSetId || "";
      if (resolvedAdSetId) {
        adsById.set(adId, {
          id: adId,
          adset_id: resolvedAdSetId,
          campaign_id: campaignId || adMetadata?.campaignId || "",
          name: adName || `Ad ${adId}`,
          status: adMetadata?.status ?? "UNKNOWN",
          creative_name:
            adMetadata?.creativeName ||
            adName ||
            `Criativo ${adId}`,
          creative_thumb: adMetadata?.creativeThumb ?? null,
          creative_link: adMetadata?.creativeLink ?? null,
          updated_at: nowIso
        });
      }
    }
  }

  for (const [adSetId, adSetMetadata] of adSetMetadataById.entries()) {
    if (!adSetsById.has(adSetId)) {
      adSetsById.set(adSetId, {
        id: adSetId,
        campaign_id: adSetMetadata.campaignId || "",
        name: adSetMetadata.name || `AdSet ${adSetId}`,
        status: adSetMetadata.status || "UNKNOWN",
        updated_at: nowIso
      });
    }
  }

  for (const [adId, adMetadata] of adMetadataById.entries()) {
    if (!adsById.has(adId) && adMetadata.adSetId) {
      adsById.set(adId, {
        id: adId,
        adset_id: adMetadata.adSetId,
        campaign_id: adMetadata.campaignId || "",
        name: adMetadata.name || `Ad ${adId}`,
        status: adMetadata.status || "UNKNOWN",
        creative_name:
          adMetadata.creativeName ||
          adMetadata.name ||
          `Criativo ${adId}`,
        creative_thumb: adMetadata.creativeThumb ?? null,
        creative_link: adMetadata.creativeLink ?? null,
        updated_at: nowIso
      });
    }
  }

  return {
    insightRows,
    adSetRows: [...adSetsById.values()],
    adRows: [...adsById.values()]
  };
}

async function upsertRowsInBatches(params) {
  const { tableName, rows, onConflict } = params;
  if (rows.length === 0) {
    return 0;
  }

  let total = 0;
  for (let from = 0; from < rows.length; from += PAGE_SIZE) {
    const batch = rows.slice(from, from + PAGE_SIZE);
    const { error } = await supabase.from(tableName).upsert(batch, { onConflict });

    if (error) {
      throw new Error(`Supabase upsert falhou em ${tableName}: ${error.message}`);
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

    const range = resolveTimeRangeLast30Days();
    let insightResult;
    try {
      insightResult = await fetchInsightsForRangeWithAdaptiveSplit(range);
    } catch (error) {
      const message = error instanceof Error ? error.message : "falha desconhecida";
      throw new Error(`Falha ao buscar insights assíncronos: ${message}`);
    }

    const reportRows = insightResult.rows;
    const campaignIds = [...new Set(reportRows.map((row) => String(row?.campaign_id ?? "").trim()).filter(Boolean))];
    const adSetIds = [...new Set(reportRows.map((row) => String(row?.adset_id ?? "").trim()).filter(Boolean))];
    const adIds = [...new Set(reportRows.map((row) => String(row?.ad_id ?? "").trim()).filter(Boolean))];

    let campaignMetadataByCampaignId;
    let adSetMetadataById;
    let adMetadataById;

    try {
      [campaignMetadataByCampaignId, adSetMetadataById, adMetadataById] = await Promise.all([
        fetchCampaignMetadataMapByIds(campaignIds),
        fetchAdSetMetadataMapByIds(adSetIds),
        fetchAdMetadataMapByIds(adIds)
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "falha desconhecida";
      throw new Error(`Falha ao buscar metadados de estrutura: ${message}`);
    }

    const { insightRows, adSetRows, adRows } = normalizeInsightRowsForSupabase(
      reportRows,
      campaignMetadataByCampaignId,
      adSetMetadataById,
      adMetadataById
    );

    const syncedAdSets = await upsertRowsInBatches({
      tableName: ADSETS_TABLE_NAME,
      rows: adSetRows,
      onConflict: "id"
    });
    const syncedAds = await upsertRowsInBatches({
      tableName: ADS_TABLE_NAME,
      rows: adRows,
      onConflict: "id"
    });
    const syncedInsights = await upsertRowsInBatches({
      tableName: INSIGHTS_TABLE_NAME,
      rows: insightRows,
      onConflict: "date,campaign_id,adset_id,ad_id"
    });

    return NextResponse.json({
      success: true,
      fetchedRows: reportRows.length,
      syncedInsights,
      syncedAdSets,
      syncedAds,
      jobsExecuted: insightResult.jobs,
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
