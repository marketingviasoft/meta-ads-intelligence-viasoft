import type {
  CampaignDeliveryGroup,
  CampaignLifecycleStatus,
  DeliveryStatus,
  MetaAd,
  MetaAdPreview,
  MetaAdSet,
  MetaCampaign,
  NormalizedInsightRow
} from "@/lib/types";
import { extractVerticalTagFromCampaignName, FALLBACK_VERTICAL_TAG } from "@/utils/campaign-tags";
import { toNumber } from "@/utils/numbers";
import { getObjectiveCategory } from "@/utils/objective";

type MetaApiError = {
  message: string;
  type?: string;
  code?: number;
  fbtrace_id?: string;
};

type MetaApiListResponse<T> = {
  data?: T[];
  error?: MetaApiError;
  paging?: {
    next?: string;
  };
};

type MetaAdPreviewResponseItem = {
  body?: string;
};

type MetaCampaignResponseItem = {
  id: string;
  name: string;
  objective: string;
  effective_status?: string;
  status?: string;
  configured_status?: string;
};

type MetaAdSetDeliveryResponseItem = {
  campaign_id?: string;
  campaign?: {
    id?: string;
  };
  end_time?: string;
  effective_status?: string;
  status?: string;
  configured_status?: string;
};

type MetaAdSetResponseItem = {
  id: string;
  name: string;
  campaign_id?: string;
  end_time?: string;
  effective_status?: string;
  status?: string;
  configured_status?: string;
};

type MetaAdResponseItem = {
  id: string;
  name: string;
  campaign_id?: string;
  adset_id?: string;
  effective_status?: string;
  status?: string;
  configured_status?: string;
  creative?: MetaAdCreativeResponseItem;
};

type MetaAdCreativeAssetFeedLinkUrl = {
  website_url?: string;
  url?: string;
  deeplink_url?: string;
};

type MetaAdCreativeCallToActionValue = {
  link?: string;
  app_destination?: string;
  phone_number?: string;
  whatsapp_number?: string;
};

type MetaAdCreativeCallToAction = {
  type?: string;
  value?: MetaAdCreativeCallToActionValue;
};

type MetaAdCreativeResponseItem = {
  id?: string;
  name?: string;
  call_to_action_type?: string;
  thumbnail_url?: string;
  image_url?: string;
  object_url?: string;
  link_url?: string;
  website_url?: string;
  template_url?: string;
  url_tags?: string;
  object_story_id?: string;
  effective_object_story_id?: string;
  instagram_permalink_url?: string;
  object_story_spec?: {
    link_data?: {
      link?: string;
      picture?: string;
      call_to_action?: MetaAdCreativeCallToAction;
      child_attachments?: Array<{
        link?: string;
        picture?: string;
        call_to_action?: MetaAdCreativeCallToAction;
      }>;
    };
    video_data?: {
      image_url?: string;
      call_to_action?: MetaAdCreativeCallToAction;
    };
    photo_data?: {
      link?: string;
      url?: string;
      call_to_action?: MetaAdCreativeCallToAction;
    };
    template_data?: {
      link?: string;
      call_to_action?: MetaAdCreativeCallToAction;
    };
  };
  asset_feed_spec?: {
    link_urls?: MetaAdCreativeAssetFeedLinkUrl[];
    call_to_action_types?: string[];
  };
  [key: string]: unknown;
};

type MetaInsightAction = {
  action_type: string;
  value: string;
};

type MetaInsightResponseItem = {
  campaign_name?: string;
  campaign_id?: string;
  date_start: string;
  date_stop: string;
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  reach?: string;
  frequency?: string;
  cpm?: string;
  cpp?: string;
  unique_clicks?: string;
  conversions?: string;
  quality_ranking?: string;
  engagement_rate_ranking?: string;
  conversion_rate_ranking?: string;
  actions?: MetaInsightAction[];
  cost_per_action_type?: MetaInsightAction[];
};

type MetaCampaignActivityInsightResponseItem = {
  campaign_id?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
};

type AdSetWithoutDeliveryReason = "COMPLETED" | "ADSET_DISABLED" | "UNKNOWN";

type MetaAsyncReportRunResponse = {
  report_run_id?: string;
  async_status?: string;
  async_percent_completion?: number;
  error?: MetaApiError;
};

type MetaInsightsAsyncParams = {
  fields: string;
  level: "campaign" | "adset" | "ad";
  timeRange: {
    since: string;
    until: string;
  };
  filtering?: Array<{
    field: string;
    operator: string;
    value: unknown;
  }>;
  breakdowns?: string[];
  timeIncrement?: 1;
  limit?: number;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
};

const GRAPH_API_BASE = "https://graph.facebook.com";
const META_RATE_LIMIT_COOLDOWN_MS = 60 * 1000;
const META_HTTP_RETRY_MAX_ATTEMPTS = 5;
const META_HTTP_RETRY_BASE_DELAY_MS = 1200;
const META_ASYNC_DEFAULT_POLL_INTERVAL_MS = 3000;
const META_ASYNC_DEFAULT_MAX_POLL_ATTEMPTS = 80;
let metaRateLimitUntilMs = 0;
const AUTO_GENERATED_CREATIVE_SUFFIX_PATTERN = /\s+\d{4}-\d{2}-\d{2}-[a-f0-9]{16,}$/i;
const AD_PREVIEW_FORMAT_CANDIDATES = [
  "DESKTOP_FEED_STANDARD",
  "MOBILE_FEED_STANDARD",
  "INSTAGRAM_STANDARD"
] as const;
const CREATIVE_FIELDS = [
  "id",
  "name",
  "call_to_action_type",
  "thumbnail_url",
  "image_url",
  "object_url",
  "link_url",
  "object_story_id",
  "effective_object_story_id",
  "instagram_permalink_url",
  "object_story_spec{link_data{link,picture,call_to_action,child_attachments},video_data{image_url,call_to_action,link},photo_data{link,url,call_to_action},template_data{link,call_to_action}}",
  "asset_feed_spec{link_urls,call_to_action_types}"
].join(",");
const INSIGHT_FIELDS = [
  "spend",
  "impressions",
  "clicks",
  "ctr",
  "cpc",
  "reach",
  "frequency",
  "cpm",
  "cpp",
  "unique_clicks",
  "conversions",
  "quality_ranking",
  "engagement_rate_ranking",
  "conversion_rate_ranking",
  "actions",
  "cost_per_action_type",
  "video_play_actions",
  "video_avg_time_watched_actions",
  "video_p25_watched_actions",
  "video_p50_watched_actions",
  "video_p75_watched_actions",
  "video_p100_watched_actions",
  "video_thruplay_watched_actions",
  "date_start",
  "date_stop"
].join(",");

function normalizeTagKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function startMetaRateLimitCooldown(): void {
  metaRateLimitUntilMs = Math.max(metaRateLimitUntilMs, Date.now() + META_RATE_LIMIT_COOLDOWN_MS);
}

function assertMetaRateLimitCooldown(): void {
  if (Date.now() < metaRateLimitUntilMs) {
    const waitSeconds = Math.ceil((metaRateLimitUntilMs - Date.now()) / 1000);
    throw new Error(
      `Meta API em cooldown temporario por limite de requests. Tente novamente em cerca de ${waitSeconds}s.`
    );
  }
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isRetryableMetaErrorCode(code: number | undefined): boolean {
  return code === 4 || code === 17;
}

function parseRetryAfterMs(retryAfterHeader: string | null): number | null {
  if (!retryAfterHeader) {
    return null;
  }

  const seconds = Number.parseInt(retryAfterHeader, 10);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  return seconds * 1000;
}

function getBackoffDelayMs(attempt: number, retryAfterMs: number | null = null): number {
  if (retryAfterMs && retryAfterMs > 0) {
    return retryAfterMs;
  }

  const exponential = META_HTTP_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1);
  const jitter = Math.floor(Math.random() * 400);
  return Math.min(exponential + jitter, 12_000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readJsonPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json().catch(() => null);
}

async function inspectMetaError(response: Response): Promise<{
  code?: number;
  retryAfterMs: number | null;
}> {
  const payload = (await readJsonPayload(response)) as { error?: MetaApiError } | null;
  const code = payload?.error?.code;
  const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));

  if (isRetryableMetaErrorCode(code)) {
    startMetaRateLimitCooldown();
  }

  return {
    code,
    retryAfterMs
  };
}

export function getMetaConfig(): {
  accessToken: string;
  adAccountId: string;
  apiVersion: string;
} {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const rawAccountId = process.env.META_AD_ACCOUNT_ID;
  const apiVersion = process.env.META_API_VERSION ?? "v25.0";

  if (!accessToken) {
    throw new Error("META_ACCESS_TOKEN não configurado");
  }

  if (!rawAccountId) {
    throw new Error("META_AD_ACCOUNT_ID não configurado");
  }

  const adAccountId = rawAccountId.startsWith("act_") ? rawAccountId : `act_${rawAccountId}`;

  return {
    accessToken,
    adAccountId,
    apiVersion
  };
}

function buildUrl(path: string, queryParams: Record<string, string>): string {
  const config = getMetaConfig();
  const url = new URL(`${GRAPH_API_BASE}/${config.apiVersion}/${path}`);

  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.set(key, value);
  }

  url.searchParams.set("access_token", config.accessToken);

  return url.toString();
}

function parseActionMap(raw: unknown): Record<string, number> {
  if (!Array.isArray(raw)) {
    return {};
  }

  return raw.reduce<Record<string, number>>((accumulator, item) => {
    if (!item || typeof item !== "object") {
      return accumulator;
    }

    const actionType = Reflect.get(item, "action_type");
    const actionValue = Reflect.get(item, "value");

    if (typeof actionType !== "string") {
      return accumulator;
    }

    accumulator[actionType] = toNumber(actionValue);
    return accumulator;
  }, {});
}

function sumActionValuesByHints(actionMap: Record<string, number>, hints: string[]): number {
  return Object.entries(actionMap).reduce((total, [actionType, value]) => {
    const normalizedType = actionType.toLowerCase();
    const hasHint = hints.some((hint) => normalizedType.includes(hint));
    return hasHint ? total + value : total;
  }, 0);
}

async function buildMetaHttpError(response: Response): Promise<Error> {
  const contentType = response.headers.get("content-type") ?? "";
  let detail = "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json().catch(() => null)) as
      | {
          error?: MetaApiError;
          message?: string;
        }
      | null;

    if (payload?.error?.message) {
      const parts = [`Meta API: ${payload.error.message}`];

      if (payload.error.code !== undefined) {
        parts.push(`code ${payload.error.code}`);
      }

      if (payload.error.type) {
        parts.push(payload.error.type);
      }

      detail = parts.join(" | ");

      if (payload.error.code === 17) {
        startMetaRateLimitCooldown();
      }
    } else if (payload?.message) {
      detail = String(payload.message);
    } else if (payload) {
      detail = JSON.stringify(payload);
    }
  } else {
    const text = await response.text().catch(() => "");
    detail = text ? text.slice(0, 600) : "";
  }

  const summary = detail || response.statusText || "Erro de comunicação com Meta API";
  return new Error(`Falha HTTP Meta API: ${response.status} ${summary}`);
}

async function requestMetaJsonWithRetry<T>(params: {
  url: string;
  method?: "GET" | "POST";
  maxAttempts?: number;
}): Promise<T> {
  const { url, method = "GET", maxAttempts = META_HTTP_RETRY_MAX_ATTEMPTS } = params;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      try {
        assertMetaRateLimitCooldown();
      } catch (cooldownError) {
        const message =
          cooldownError instanceof Error ? cooldownError.message : String(cooldownError ?? "");
        const secondsMatch = message.match(/cerca de\s+(\d+)s/i);
        const cooldownMs = secondsMatch?.[1]
          ? Number.parseInt(secondsMatch[1], 10) * 1000
          : getBackoffDelayMs(attempt);

        if (attempt < maxAttempts) {
          await sleep(Math.max(1000, cooldownMs));
          continue;
        }

        throw cooldownError;
      }

      const response = await fetch(url, {
        method,
        cache: "no-store"
      });

      if (!response.ok) {
        const inspection = await inspectMetaError(response.clone());
        const retryable =
          isRetryableHttpStatus(response.status) || isRetryableMetaErrorCode(inspection.code);

        if (retryable && attempt < maxAttempts) {
          await sleep(getBackoffDelayMs(attempt, inspection.retryAfterMs));
          continue;
        }

        throw await buildMetaHttpError(response);
      }

      const payload = (await readJsonPayload(response)) as
        | (T & {
            error?: MetaApiError;
          })
        | null;

      if (!payload) {
        if (attempt < maxAttempts) {
          await sleep(getBackoffDelayMs(attempt));
          continue;
        }

        throw new Error("Meta API: resposta vazia ou inválida.");
      }

      if (payload.error) {
        if (isRetryableMetaErrorCode(payload.error.code)) {
          startMetaRateLimitCooldown();

          if (attempt < maxAttempts) {
            await sleep(getBackoffDelayMs(attempt));
            continue;
          }
        }

        throw new Error(`Meta API: ${payload.error.message}`);
      }

      return payload;
    } catch (error) {
      const isNetworkFailure =
        error instanceof TypeError ||
        (error instanceof Error &&
          (error.message.includes("fetch failed") || error.message.includes("ECONNRESET")));

      if (isNetworkFailure && attempt < maxAttempts) {
        await sleep(getBackoffDelayMs(attempt));
        continue;
      }

      throw error;
    }
  }

  throw new Error("Meta API: falha após múltiplas tentativas.");
}

async function fetchMetaList<T>(path: string, queryParams: Record<string, string>): Promise<T[]> {
  const items: T[] = [];
  let nextUrl: string | null = buildUrl(path, queryParams);
  let safetyPageCounter = 0;

  while (nextUrl) {
    if (safetyPageCounter >= 60) {
      throw new Error("Meta API: paginação excedeu o limite de segurança (60 páginas).");
    }

    const payload: MetaApiListResponse<T> = await requestMetaJsonWithRetry<MetaApiListResponse<T>>({
      url: nextUrl,
      method: "GET"
    });

    items.push(...(payload.data ?? []));
    nextUrl = payload.paging?.next ?? null;
    safetyPageCounter += 1;
  }

  return items;
}

async function fetchMetaObject<T>(
  path: string,
  queryParams: Record<string, string>,
  method: "GET" | "POST" = "GET"
): Promise<T> {
  const url = buildUrl(path, queryParams);

  return requestMetaJsonWithRetry<T>({
    url,
    method
  });
}

function normalizeCampaign(
  item: MetaCampaignResponseItem,
  deliveryStatus: DeliveryStatus,
  activity?: {
    spend: number;
    impressions: number;
    clicks: number;
  }
): MetaCampaign {
  const verticalTag = extractVerticalTagFromCampaignName(item.name);
  const effective = (item.effective_status ?? "").toUpperCase();
  const configured = resolveConfiguredStatus(item.status, item.configured_status).toUpperCase();
  const lifecycleStatus = resolveCampaignLifecycleStatus({
    effectiveStatus: effective,
    configuredStatus: configured,
    deliveryStatus
  });
  const deliveryGroup = resolveCampaignDeliveryGroup({
    effectiveStatus: effective,
    configuredStatus: configured,
    deliveryStatus
  });

  const periodSpend = activity?.spend ?? 0;
  const periodImpressions = activity?.impressions ?? 0;
  const periodClicks = activity?.clicks ?? 0;

  return {
    id: item.id,
    name: item.name,
    objective: item.objective,
    objectiveCategory: getObjectiveCategory(item.objective),
    effectiveStatus: item.effective_status ?? "UNKNOWN",
    verticalTag,
    deliveryStatus,
    lifecycleStatus,
    deliveryGroup,
    hasActivityInRange: periodSpend > 0 || periodImpressions > 0,
    periodSpend,
    periodImpressions,
    periodClicks
  };
}

function normalizeInsightRow(item: MetaInsightResponseItem): NormalizedInsightRow {
  const spend = toNumber(item.spend);
  const impressions = toNumber(item.impressions);
  const clicks = toNumber(item.clicks);
  const actions = parseActionMap(item.actions);
  const costPerActionType = parseActionMap(item.cost_per_action_type);

  // Merge video actions if they are returned as separate fields
  const videoFields = [
    "video_play_actions",
    "video_avg_time_watched_actions",
    "video_3_sec_watched_actions",
    "video_30_sec_watched_actions",
    "video_p25_watched_actions",
    "video_p50_watched_actions",
    "video_p75_watched_actions",
    "video_p95_watched_actions",
    "video_p100_watched_actions",
    "video_thruplay_watched_actions"
  ];

  for (const field of videoFields) {
    const fieldActions = parseActionMap(Reflect.get(item, field));
    const totalValue = Object.values(fieldActions).reduce((a, b) => a + b, 0);
    if (totalValue > 0) {
      actions[field] = totalValue;
    }
  }

  const purchases = sumActionValuesByHints(actions, ["purchase"]);
  const leads = sumActionValuesByHints(actions, ["lead"]);
  const inlineLinkClicks = sumActionValuesByHints(actions, ["inline_link_click"]);
  const outboundClicks = sumActionValuesByHints(actions, ["outbound_click"]);

  return {
    dateStart: item.date_start,
    dateStop: item.date_stop,
    spend,
    impressions,
    clicks,
    ctr: toNumber(item.ctr),
    cpc: toNumber(item.cpc),
    reach: toNumber(item.reach),
    frequency: toNumber(item.frequency),
    cpm: toNumber(item.cpm),
    cpp: toNumber(item.cpp),
    uniqueClicks: toNumber(item.unique_clicks),
    inlineLinkClicks,
    outboundClicks,
    conversions: toNumber(item.conversions),
    purchases,
    leads,
    qualityRanking: item.quality_ranking?.trim() || null,
    engagementRateRanking: item.engagement_rate_ranking?.trim() || null,
    conversionRateRanking: item.conversion_rate_ranking?.trim() || null,
    actions,
    costPerActionType
  };
}

function isStatusActive(value: string | undefined): boolean {
  return (value ?? "").toUpperCase() === "ACTIVE";
}

function resolveAdSetCampaignId(item: MetaAdSetDeliveryResponseItem | MetaAdSetResponseItem): string {
  if (typeof item.campaign_id === "string" && item.campaign_id) {
    return item.campaign_id;
  }

  if ("campaign" in item && item.campaign && typeof item.campaign.id === "string" && item.campaign.id) {
    return item.campaign.id;
  }

  return "";
}

function isAdSetDeliveringActive(
  item: MetaAdSetDeliveryResponseItem | MetaAdSetResponseItem
): boolean {
  if ("end_time" in item && hasAdSetEnded(item.end_time)) {
    return false;
  }

  if (!isStatusActive(item.effective_status)) {
    return false;
  }

  const configuredStatuses = [item.status, item.configured_status].filter(
    (value): value is string => typeof value === "string"
  );

  if (configuredStatuses.length === 0) {
    return true;
  }

  return configuredStatuses.some((status) => isStatusActive(status));
}

function hasAdSetEnded(endTime: string | undefined): boolean {
  if (!endTime) {
    return false;
  }

  const parsed = Date.parse(endTime);
  if (Number.isNaN(parsed)) {
    return false;
  }

  return parsed <= Date.now();
}

function classifyAdSetWithoutDeliveryReason(
  item: MetaAdSetDeliveryResponseItem | MetaAdSetResponseItem
): AdSetWithoutDeliveryReason {
  if ("end_time" in item && hasAdSetEnded(item.end_time)) {
    return "COMPLETED";
  }

  const effective = (item.effective_status ?? "").toUpperCase();
  const configured = resolveConfiguredStatus(item.status, item.configured_status).toUpperCase();

  if (effective.includes("COMPLETED") || configured.includes("COMPLETED")) {
    return "COMPLETED";
  }

  if (
    effective === "ADSET_PAUSED" ||
    effective === "PAUSED" ||
    effective === "CAMPAIGN_PAUSED" ||
    configured === "PAUSED"
  ) {
    return "ADSET_DISABLED";
  }

  return "UNKNOWN";
}

function resolveCampaignDeliveryStatusFromAdSets(
  adsets: Array<MetaAdSetDeliveryResponseItem | MetaAdSetResponseItem>
): DeliveryStatus {
  if (adsets.some((adset) => isAdSetDeliveringActive(adset))) {
    return "ACTIVE";
  }

  const reasons = new Set<AdSetWithoutDeliveryReason>();

  for (const adset of adsets) {
    reasons.add(classifyAdSetWithoutDeliveryReason(adset));
  }

  if (reasons.size === 0) {
    return "WITHOUT_DELIVERY";
  }

  if (reasons.size === 1 && reasons.has("COMPLETED")) {
    return "COMPLETED";
  }

  if (reasons.has("ADSET_DISABLED")) {
    return "ADSET_DISABLED";
  }

  if (reasons.has("COMPLETED")) {
    return "COMPLETED";
  }

  return "WITHOUT_DELIVERY";
}

function mapCampaignDeliveryStatus(
  adsets: MetaAdSetDeliveryResponseItem[]
): Map<string, DeliveryStatus> {
  const grouped = new Map<string, MetaAdSetDeliveryResponseItem[]>();

  for (const adset of adsets) {
    const campaignId = resolveAdSetCampaignId(adset);
    if (!campaignId) {
      continue;
    }

    const existing = grouped.get(campaignId);
    if (existing) {
      existing.push(adset);
    } else {
      grouped.set(campaignId, [adset]);
    }
  }

  const statusMap = new Map<string, DeliveryStatus>();

  for (const [campaignId, campaignAdSets] of grouped.entries()) {
    statusMap.set(campaignId, resolveCampaignDeliveryStatusFromAdSets(campaignAdSets));
  }

  return statusMap;
}

function resolveConfiguredStatus(
  status: string | undefined,
  configuredStatus: string | undefined
): string {
  if (typeof status === "string" && status) {
    return status;
  }

  if (typeof configuredStatus === "string" && configuredStatus) {
    return configuredStatus;
  }

  return "UNKNOWN";
}

function resolveCampaignLifecycleStatus(params: {
  effectiveStatus: string;
  configuredStatus: string;
  deliveryStatus: DeliveryStatus;
}): CampaignLifecycleStatus {
  const { effectiveStatus, configuredStatus, deliveryStatus } = params;

  if (
    effectiveStatus.includes("ARCHIVED") ||
    configuredStatus.includes("ARCHIVED") ||
    effectiveStatus.includes("DELETED") ||
    configuredStatus.includes("DELETED")
  ) {
    return "ARCHIVED";
  }

  if (
    effectiveStatus.includes("PAUSED") ||
    configuredStatus.includes("PAUSED") ||
    deliveryStatus === "ADSET_DISABLED"
  ) {
    return "PAUSED";
  }

  if (
    effectiveStatus.includes("COMPLETED") ||
    configuredStatus.includes("COMPLETED") ||
    deliveryStatus === "COMPLETED"
  ) {
    return "COMPLETED";
  }

  if (effectiveStatus === "ACTIVE" && deliveryStatus === "ACTIVE") {
    return "RUNNING";
  }

  return "WITHOUT_DELIVERY";
}

function resolveCampaignDeliveryGroup(params: {
  effectiveStatus: string;
  configuredStatus: string;
  deliveryStatus: DeliveryStatus;
}): CampaignDeliveryGroup {
  const { effectiveStatus, configuredStatus, deliveryStatus } = params;
  const statusSignal = `${effectiveStatus} ${configuredStatus}`.toUpperCase();

  if (statusSignal.includes("ARCHIVED") || statusSignal.includes("DELETED")) {
    return "ARCHIVED";
  }

  if (
    statusSignal.includes("DISAPPROVED") ||
    statusSignal.includes("PENDING_BILLING_INFO") ||
    statusSignal.includes("WITH_ERRORS")
  ) {
    return "WITH_ISSUES";
  }

  if (statusSignal.includes("PENDING_REVIEW") || statusSignal.includes("PENDING")) {
    return "PENDING_REVIEW";
  }

  if (
    statusSignal.includes("PAUSED") ||
    statusSignal.includes("CAMPAIGN_PAUSED") ||
    statusSignal.includes("ADSET_PAUSED") ||
    deliveryStatus === "ADSET_DISABLED"
  ) {
    return "PAUSED";
  }

  if (statusSignal.includes("ACTIVE")) {
    return "ACTIVE";
  }

  return "PAUSED";
}

function resolveAdSetId(item: MetaAdResponseItem): string {
  if (typeof item.adset_id === "string" && item.adset_id) {
    return item.adset_id;
  }

  return "";
}

function resolveCreativeId(creative: MetaAdCreativeResponseItem | undefined): string {
  if (typeof creative?.id === "string") {
    return creative.id;
  }

  return "";
}

function normalizeCreativeName(rawName: string): string {
  const trimmedName = rawName.trim();
  if (!trimmedName) {
    return "";
  }

  const withoutAutoGeneratedSuffix = trimmedName.replace(
    AUTO_GENERATED_CREATIVE_SUFFIX_PATTERN,
    ""
  );
  const normalized = withoutAutoGeneratedSuffix.replace(/\s+/g, " ").trim();

  // If the name is just a template placeholder like {{product.name}}, treat it as empty
  // so the fallback to Ad Name can kick in.
  if (/^\{\{product\.[a-z_]+\}\}$|^Criativo não identificado$/i.test(normalized)) {
    return "";
  }

  return normalized || trimmedName;
}

function resolveCreativeName(creative: MetaAdCreativeResponseItem | undefined): string {
  if (typeof creative?.name === "string" && creative.name.trim()) {
    return normalizeCreativeName(creative.name);
  }

  const creativeId = resolveCreativeId(creative);
  if (creativeId) {
    return `Criativo ${creativeId}`;
  }

  return "Criativo não identificado";
}

function resolveCreativePreviewUrl(creative: MetaAdCreativeResponseItem | undefined): string {
  const objectStorySpec = creative?.object_story_spec;
  const linkData = objectStorySpec?.link_data;
  const firstChildAttachment = linkData?.child_attachments?.[0];

  const candidates = [
    creative?.image_url,
    objectStorySpec?.video_data?.image_url,
    linkData?.picture,
    firstChildAttachment?.picture,
    objectStorySpec?.photo_data?.url,
    creative?.thumbnail_url
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
}

function extractIframeUrlFromAdPreviewBody(rawBody: string): string {
  const body = rawBody.trim();
  if (!body) {
    return "";
  }

  const iframeMatch = body.match(/<iframe[^>]+src=(["'])(.*?)\1/i);
  if (!iframeMatch?.[2]) {
    return "";
  }

  const src = iframeMatch[2].replace(/&amp;/g, "&").trim();
  if (!src) {
    return "";
  }

  if (src.startsWith("//")) {
    return `https:${src}`;
  }

  return src;
}

function isLikelyRestrictedIframeUrl(iframeUrl: string): boolean {
  try {
    const parsed = new URL(iframeUrl);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (host.includes("instagram.com")) {
      return true;
    }

    if (host.includes("facebook.com")) {
      if (
        path.includes("/profile") ||
        path.includes("/permalink") ||
        path.includes("/posts") ||
        path.includes("/photos")
      ) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

function isRestrictedPreviewHtml(html: string): boolean {
  const normalized = html.toLowerCase();
  return (
    normalized.includes("você não tem permissão para acessar este perfil") ||
    normalized.includes("voce nao tem permissao para acessar este perfil") ||
    normalized.includes("you don't have permission to access this profile") ||
    normalized.includes("you do not have permission to access this profile")
  );
}

async function inspectPreviewIframe(iframeUrl: string): Promise<{
  embeddable: boolean;
  restricted: boolean;
}> {
  if (!iframeUrl) {
    return { embeddable: false, restricted: false };
  }

  if (isLikelyRestrictedIframeUrl(iframeUrl)) {
    return { embeddable: false, restricted: true };
  }

  try {
    const response = await fetch(iframeUrl, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent": "MetaAdsIntelligencePreviewChecker/1.0"
      }
    });

    if (!response.ok) {
      return { embeddable: false, restricted: false };
    }

    const html = await response.text();
    if (!html) {
      return { embeddable: true, restricted: false };
    }

    if (isRestrictedPreviewHtml(html)) {
      return { embeddable: false, restricted: true };
    }

    return { embeddable: true, restricted: false };
  } catch {
    return { embeddable: false, restricted: false };
  }
}

function normalizeAdSet(item: MetaAdSetResponseItem, campaignIdFromContext: string): MetaAdSet {
  return {
    id: item.id,
    name: item.name,
    campaignId: resolveAdSetCampaignId(item) || campaignIdFromContext,
    effectiveStatus: item.effective_status ?? "UNKNOWN",
    configuredStatus: resolveConfiguredStatus(item.status, item.configured_status)
  };
}

function normalizeAd(
  item: MetaAdResponseItem,
  adSetIdFromContext: string
): MetaAd {
  const creative = item.creative;
  const adSetId = resolveAdSetId(item) || adSetIdFromContext;

  return {
    id: item.id,
    name: item.name,
    campaignId: item.campaign_id ?? "",
    adSetId,
    effectiveStatus: item.effective_status ?? "UNKNOWN",
    configuredStatus: resolveConfiguredStatus(item.status, item.configured_status),
    creativeId: resolveCreativeId(creative),
    creativeName: resolveCreativeName(creative),
    creativePreviewUrl: resolveCreativePreviewUrl(creative)
  };
}

async function resolveCampaignDeliveryStatus(campaignId: string): Promise<DeliveryStatus> {
  const adsets = await fetchMetaList<MetaAdSetDeliveryResponseItem>(`${campaignId}/adsets`, {
    fields: "effective_status,status,configured_status,end_time",
    limit: "5000"
  });

  return resolveCampaignDeliveryStatusFromAdSets(adsets);
}

export async function fetchCampaignCatalog(): Promise<MetaCampaign[]> {
  const { adAccountId } = getMetaConfig();

  const [campaigns, campaignDeliveryAdSets] = await Promise.all([
    fetchMetaList<MetaCampaignResponseItem>(`${adAccountId}/campaigns`, {
      fields: "id,name,objective,effective_status,status,configured_status",
      limit: "200"
    }),
    fetchMetaList<MetaAdSetDeliveryResponseItem>(`${adAccountId}/adsets`, {
      fields: "campaign_id,campaign{id},effective_status,status,configured_status,end_time",
      limit: "5000"
    })
  ]);
  const campaignDeliveryStatus = mapCampaignDeliveryStatus(campaignDeliveryAdSets);

  return campaigns
    .map((campaign) =>
      normalizeCampaign(campaign, campaignDeliveryStatus.get(campaign.id) ?? "WITHOUT_DELIVERY")
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchCampaignActivityByRange(params: {
  since: string;
  until: string;
}): Promise<Map<string, { spend: number; impressions: number; clicks: number }>> {
  const { since, until } = params;

  const insights = await fetchMetaInsightsAsync<MetaCampaignActivityInsightResponseItem>({
    fields: "campaign_id,spend,impressions,clicks",
    level: "campaign",
    timeRange: {
      since,
      until
    },
    limit: 5000
  });

  const byCampaign = new Map<string, { spend: number; impressions: number; clicks: number }>();

  for (const row of insights) {
    const campaignId = row.campaign_id?.trim();
    if (!campaignId) {
      continue;
    }

    const spend = toNumber(row.spend);
    const impressions = toNumber(row.impressions);
    const clicks = toNumber(row.clicks);
    const existing = byCampaign.get(campaignId);

    if (existing) {
      byCampaign.set(campaignId, {
        spend: existing.spend + spend,
        impressions: existing.impressions + impressions,
        clicks: existing.clicks + clicks
      });
    } else {
      byCampaign.set(campaignId, {
        spend,
        impressions,
        clicks
      });
    }
  }

  return byCampaign;
}

export async function fetchActiveCampaigns(): Promise<MetaCampaign[]> {
  const campaigns = await fetchCampaignCatalog();
  return campaigns
    .filter((campaign) => isStatusActive(campaign.effectiveStatus))
    .filter((campaign) => campaign.deliveryStatus === "ACTIVE")
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchCampaignById(campaignId: string): Promise<MetaCampaign | null> {
  const campaign = await fetchMetaObject<MetaCampaignResponseItem>(campaignId, {
    fields: "id,name,objective,effective_status,status,configured_status"
  });

  if (!campaign?.id) {
    return null;
  }

  const deliveryStatus = await resolveCampaignDeliveryStatus(campaignId);
  return normalizeCampaign(campaign, deliveryStatus);
}

export async function fetchCampaignAdSets(campaignId: string): Promise<MetaAdSet[]> {
  const adSets = await fetchMetaList<MetaAdSetResponseItem>(`${campaignId}/adsets`, {
    fields: "id,name,effective_status,status,configured_status,end_time",
    limit: "5000"
  });

  return adSets
    .filter((adSet) => Boolean(adSet.id && adSet.name))
    .map((adSet) => normalizeAdSet(adSet, campaignId))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchAdSetAds(adSetId: string): Promise<MetaAd[]> {
  const ads = await fetchMetaList<MetaAdResponseItem>(`${adSetId}/ads`, {
    fields: `id,name,campaign_id,adset_id,effective_status,status,configured_status,creative{${CREATIVE_FIELDS}}`,
    limit: "5000"
  });

  return ads
    .filter((ad) => Boolean(ad.id && ad.name))
    .map((ad) => normalizeAd(ad, adSetId))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function isAdPreviewFormatValidationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  if (message.includes("code 17") || message.includes("cooldown")) {
    return false;
  }

  return (
    message.includes("code 100") ||
    message.includes("ad_format") ||
    message.includes("unsupported") ||
    message.includes("invalid")
  );
}

export async function fetchAdPreview(adId: string): Promise<MetaAdPreview> {
  let firstError: Error | null = null;
  let sawRestrictedPreview = false;
  let sawNonEmbeddablePreview = false;

  for (const adFormat of AD_PREVIEW_FORMAT_CANDIDATES) {
    try {
      const previews = await fetchMetaList<MetaAdPreviewResponseItem>(`${adId}/previews`, {
        ad_format: adFormat,
        fields: "body",
        limit: "1"
      });

      const previewBody =
        previews.find((item) => typeof item.body === "string" && item.body.trim())?.body ?? "";
      const iframeUrl = extractIframeUrlFromAdPreviewBody(previewBody);

      if (!iframeUrl) {
        continue;
      }

      const inspection = await inspectPreviewIframe(iframeUrl);
      if (inspection.embeddable) {
        return {
          adId,
          adFormat,
          iframeUrl
        };
      }

      sawRestrictedPreview ||= inspection.restricted;
      sawNonEmbeddablePreview = true;
    } catch (error) {
      if (!firstError && error instanceof Error) {
        firstError = error;
      }

      if (isAdPreviewFormatValidationError(error)) {
        continue;
      }

      throw error;
    }
  }

  if (firstError) {
    throw firstError;
  }

  if (sawRestrictedPreview) {
    throw new Error("A Meta bloqueou este preview por permissão ou política do perfil.");
  }

  if (sawNonEmbeddablePreview) {
    throw new Error("A Meta retornou um preview não incorporável para este anúncio.");
  }

  throw new Error("Preview avançado indisponível para este anúncio.");
}

function normalizeAsyncStatus(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isAsyncJobCompleted(status: string): boolean {
  return status === "job completed" || status === "completed";
}

function isAsyncJobFailed(status: string): boolean {
  return (
    status === "job failed" ||
    status === "failed" ||
    status === "job skipped" ||
    status === "skipped"
  );
}

export async function fetchMetaInsightsAsync<T>(params: MetaInsightsAsyncParams): Promise<T[]> {
  const {
    fields,
    level,
    timeRange,
    filtering,
    breakdowns,
    timeIncrement,
    limit = 5000,
    pollIntervalMs = META_ASYNC_DEFAULT_POLL_INTERVAL_MS,
    maxPollAttempts = META_ASYNC_DEFAULT_MAX_POLL_ATTEMPTS
  } = params;
  const { adAccountId } = getMetaConfig();

  const startQuery: Record<string, string> = {
    fields,
    level,
    time_range: JSON.stringify(timeRange),
    limit: String(limit),
    async: "true"
  };

  if (filtering && filtering.length > 0) {
    startQuery.filtering = JSON.stringify(filtering);
  }

  if (breakdowns && breakdowns.length > 0) {
    startQuery.breakdowns = breakdowns.join(",");
  }

  if (timeIncrement) {
    startQuery.time_increment = String(timeIncrement);
  }

  const startPayload = await fetchMetaObject<MetaAsyncReportRunResponse>(
    `${adAccountId}/insights`,
    startQuery,
    "POST"
  );

  const reportRunId = startPayload.report_run_id?.trim();
  if (!reportRunId) {
    throw new Error("Meta API: não foi possível iniciar o relatório assíncrono.");
  }

  let completed = false;

  for (let attempt = 1; attempt <= maxPollAttempts; attempt += 1) {
    if (attempt > 1) {
      await sleep(pollIntervalMs);
    }

    const statusPayload = await fetchMetaObject<MetaAsyncReportRunResponse>(reportRunId, {
      fields: "async_status,async_percent_completion"
    });

    const normalizedStatus = normalizeAsyncStatus(statusPayload.async_status);

    if (isAsyncJobCompleted(normalizedStatus)) {
      completed = true;
      break;
    }

    if (isAsyncJobFailed(normalizedStatus)) {
      throw new Error(
        `Meta API: relatório assíncrono falhou (${statusPayload.async_status ?? "status desconhecido"}).`
      );
    }
  }

  if (!completed) {
    throw new Error("Meta API: timeout aguardando conclusão do relatório assíncrono.");
  }

  return fetchMetaList<T>(`${reportRunId}/insights`, {
    fields,
    limit: String(limit)
  });
}

export async function fetchCampaignInsights(params: {
  campaignId: string;
  since: string;
  until: string;
  timeIncrement?: 1;
}): Promise<NormalizedInsightRow[]> {
  const { campaignId, since, until, timeIncrement } = params;

  const insights = await fetchMetaInsightsAsync<MetaInsightResponseItem>({
    fields: INSIGHT_FIELDS,
    level: "campaign",
    timeRange: {
      since,
      until
    },
    filtering: [
      {
        field: "campaign.id",
        operator: "EQUAL",
        value: [campaignId]
      }
    ],
    timeIncrement,
    limit: 5000
  });

  return insights.map(normalizeInsightRow);
}

export async function fetchAdSetInsights(params: {
  adSetId: string;
  since: string;
  until: string;
  timeIncrement?: 1;
}): Promise<NormalizedInsightRow[]> {
  const { adSetId, since, until, timeIncrement } = params;

  const insights = await fetchMetaInsightsAsync<MetaInsightResponseItem>({
    fields: INSIGHT_FIELDS,
    level: "adset",
    timeRange: {
      since,
      until
    },
    filtering: [
      {
        field: "adset.id",
        operator: "EQUAL",
        value: [adSetId]
      }
    ],
    timeIncrement,
    limit: 5000
  });

  return insights.map(normalizeInsightRow);
}

export async function fetchAdInsights(params: {
  adId: string;
  since: string;
  until: string;
  timeIncrement?: 1;
}): Promise<NormalizedInsightRow[]> {
  const { adId, since, until, timeIncrement } = params;

  const insights = await fetchMetaInsightsAsync<MetaInsightResponseItem>({
    fields: INSIGHT_FIELDS,
    level: "ad",
    timeRange: {
      since,
      until
    },
    filtering: [
      {
        field: "ad.id",
        operator: "EQUAL",
        value: [adId]
      }
    ],
    timeIncrement,
    limit: 5000
  });

  return insights.map(normalizeInsightRow);
}

export async function fetchVerticalSpendInMonthRange(params: {
  verticalTag: string;
  since: string;
  until: string;
}): Promise<number> {
  const { verticalTag, since, until } = params;

  const insights = await fetchMetaInsightsAsync<MetaInsightResponseItem>({
    fields: "campaign_id,campaign_name,spend,impressions",
    level: "campaign",
    timeRange: {
      since,
      until
    },
    limit: 5000
  });

  const targetVertical = normalizeTagKey(verticalTag || FALLBACK_VERTICAL_TAG);

  return insights.reduce((total, row) => {
    const spend = toNumber(row.spend);
    const impressions = toNumber(row.impressions);

    // Aproxima o comportamento do filtro "Tiveram veiculação" no período.
    if (impressions <= 0 || spend <= 0) {
      return total;
    }

    const campaignVertical = normalizeTagKey(
      extractVerticalTagFromCampaignName(row.campaign_name ?? FALLBACK_VERTICAL_TAG)
    );

    if (campaignVertical !== targetVertical) {
      return total;
    }

    return total + spend;
  }, 0);
}

export async function fetchAdBreakdowns(params: {
  adId: string;
  since: string;
  until: string;
  breakdowns: string[];
}): Promise<NormalizedInsightRow[]> {
  const { adId, since, until, breakdowns } = params;

  const insights = await fetchMetaInsightsAsync<MetaInsightResponseItem>({
    fields: "spend,impressions,clicks,actions",
    level: "ad",
    timeRange: {
      since,
      until
    },
    filtering: [
      {
        field: "ad.id",
        operator: "EQUAL",
        value: [adId]
      }
    ],
    breakdowns,
    limit: 5000
  });

  return insights.map((row) => {
    const normalized = normalizeInsightRow(row);
    // Preservar os campos de breakdown no objeto retornado
    for (const key of breakdowns) {
      if (Reflect.has(row, key)) {
        Reflect.set(normalized, key, Reflect.get(row, key));
      }
    }
    return normalized;
  });
}

