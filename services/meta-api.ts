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

type MetaStoryAttachmentItem = {
  url?: string;
  unshimmed_url?: string;
  target?: {
    url?: string;
  };
  subattachments?: {
    data?: MetaStoryAttachmentItem[];
  };
};

type MetaStoryResponseItem = {
  id?: string;
  permalink_url?: string;
  attachments?: {
    data?: MetaStoryAttachmentItem[];
  };
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

type MetaAdSetPromotedObject = {
  whatsapp_number?: string;
  whatsapp_phone_number?: string;
  page_id?: string;
  link?: string;
  website_url?: string;
  object_store_url?: string;
  custom_url?: string;
};

type MetaPageMessagingResponseItem = {
  id?: string;
  whatsapp_number?: string;
  whatsapp_phone_number?: string;
  linked_whatsapp_phone_number?: string;
  phone?: string;
};

type MetaAdSetDestinationResponseItem = {
  id?: string;
  destination_type?: string;
  promoted_object?: MetaAdSetPromotedObject;
  campaign?: {
    objective?: string;
  };
};

type MetaAdSetDestinationContext = {
  destinationType: string;
  whatsappNumber: string;
  pageId: string;
  objectiveSignal: string;
  websiteUrl: string;
};

type MetaAdResponseItem = {
  id: string;
  name: string;
  campaign_id?: string;
  adset_id?: string;
  destination_type?: string;
  call_to_action_type?: string;
  promoted_object?: MetaAdSetPromotedObject;
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
const DESTINATION_DIAGNOSTIC_ENABLED = process.env.META_DESTINATION_DIAGNOSTIC_LOG === "1";
const DESTINATION_PREVIEW_FALLBACK_ENABLED =
  process.env.META_DESTINATION_PREVIEW_FALLBACK === "1";
const URL_HINT_KEY_PATTERN = /(url|link|website|destination|href)/i;

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

function getMetaConfig(): {
  accessToken: string;
  adAccountId: string;
  apiVersion: string;
} {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const rawAccountId = process.env.META_AD_ACCOUNT_ID;
  const apiVersion = process.env.META_API_VERSION ?? "v21.0";

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
    "video_p25_watched_actions",
    "video_p50_watched_actions",
    "video_p75_watched_actions",
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

function collectCreativeCallToActions(
  creative: MetaAdCreativeResponseItem | undefined
): MetaAdCreativeCallToAction[] {
  const objectStorySpec = creative?.object_story_spec;

  const candidates = [
    objectStorySpec?.video_data?.call_to_action,
    objectStorySpec?.link_data?.call_to_action,
    objectStorySpec?.photo_data?.call_to_action,
    objectStorySpec?.template_data?.call_to_action
  ];

  return candidates.filter(
    (candidate): candidate is MetaAdCreativeCallToAction =>
      Boolean(candidate && typeof candidate === "object")
  );
}

function collectCreativeCallToActionLinks(
  creative: MetaAdCreativeResponseItem | undefined
): string[] {
  return collectCreativeCallToActions(creative)
    .map((cta) => cta.value?.link)
    .filter((link): link is string => typeof link === "string" && Boolean(link.trim()))
    .map((link) => link.trim());
}

function normalizeSignal(value: string | undefined): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toUpperCase();
}

function createAdSetDestinationContext(
  adSet: MetaAdSetDestinationResponseItem | null
): MetaAdSetDestinationContext {
  const websiteUrl = collectDestinationCandidates([
    adSet?.promoted_object?.link,
    adSet?.promoted_object?.website_url,
    adSet?.promoted_object?.custom_url,
    adSet?.promoted_object?.object_store_url
  ]).find(Boolean) ?? "";

  return {
    destinationType: normalizeSignal(adSet?.destination_type),
    whatsappNumber:
      normalizeWhatsAppNumber(adSet?.promoted_object?.whatsapp_number) ||
      normalizeWhatsAppNumber(adSet?.promoted_object?.whatsapp_phone_number),
    pageId: typeof adSet?.promoted_object?.page_id === "string" ? adSet.promoted_object.page_id : "",
    objectiveSignal: normalizeSignal(adSet?.campaign?.objective),
    websiteUrl
  };
}

function mergeDestinationContext(
  adSetContext: MetaAdSetDestinationContext | undefined,
  destinationType: string | undefined,
  promotedObject: MetaAdSetPromotedObject | undefined,
  callToActionType: string | undefined
): MetaAdSetDestinationContext {
  const normalizedDestinationType = normalizeSignal(destinationType);
  const normalizedCallToActionType = normalizeSignal(callToActionType);
  const promotedWhatsAppNumber =
    normalizeWhatsAppNumber(promotedObject?.whatsapp_number) ||
    normalizeWhatsAppNumber(promotedObject?.whatsapp_phone_number);
  const promotedPageId =
    typeof promotedObject?.page_id === "string" ? promotedObject.page_id : "";
  const promotedWebsiteUrl = collectDestinationCandidates([
    promotedObject?.link,
    promotedObject?.website_url,
    promotedObject?.custom_url,
    promotedObject?.object_store_url
  ]).find(Boolean) ?? "";

  return {
    destinationType: [normalizedDestinationType, normalizedCallToActionType, adSetContext?.destinationType]
      .filter(Boolean)
      .join(" "),
    whatsappNumber: promotedWhatsAppNumber || adSetContext?.whatsappNumber || "",
    pageId: promotedPageId || adSetContext?.pageId || "",
    objectiveSignal: adSetContext?.objectiveSignal || "",
    websiteUrl: promotedWebsiteUrl || adSetContext?.websiteUrl || ""
  };
}

function isWhatsAppUrl(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("wa.me/") ||
    normalized.includes("whatsapp.com/") ||
    normalized.startsWith("whatsapp://")
  );
}

function isMessengerUrl(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes("m.me/") || normalized.includes("messenger.com/");
}

function isInstagramDirectUrl(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes("instagram.com/direct");
}

function isSocialPostUrl(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("instagram.com/p/") ||
    normalized.includes("instagram.com/reel/") ||
    normalized.includes("facebook.com/") && normalized.includes("/posts/")
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isMetaSocialHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "instagram.com" ||
    host.endsWith(".instagram.com") ||
    host === "facebook.com" ||
    host.endsWith(".facebook.com") ||
    host === "fb.watch" ||
    host.endsWith(".fb.watch")
  );
}

function isMetaOwnedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    isMetaSocialHost(host) ||
    host === "l.facebook.com" ||
    host.endsWith(".l.facebook.com") ||
    host === "l.instagram.com" ||
    host.endsWith(".l.instagram.com") ||
    host.endsWith(".fbcdn.net") ||
    host.endsWith(".fbsbx.com") ||
    host.endsWith(".cdninstagram.com") ||
    host.endsWith(".scontent.xx.fbcdn.net")
  );
}

function isMetaOwnedUrl(value: string): boolean {
  if (!isHttpUrl(value)) {
    return false;
  }

  try {
    return isMetaOwnedHost(new URL(value).hostname);
  } catch {
    return false;
  }
}

function isLikelyCreativeAssetUrl(value: string): boolean {
  if (!isHttpUrl(value)) {
    return false;
  }

  try {
    const parsed = new URL(value);
    const assetExtensionPattern = /\.(?:jpe?g|png|gif|webp|svg|mp4|mov|webm|m3u8|avi)$/i;
    if (assetExtensionPattern.test(parsed.pathname)) {
      return true;
    }

    return (
      parsed.pathname.includes("/scontent/") ||
      parsed.pathname.includes("/t51.29350-15/") ||
      parsed.pathname.includes("/v/t39.30808-6/")
    );
  } catch {
    return false;
  }
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function unwrapMetaRedirectUrlOnce(value: string): string {
  if (!isHttpUrl(value)) {
    return value;
  }

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    const isMetaRedirectHost =
      host === "l.instagram.com" ||
      host.endsWith(".l.instagram.com") ||
      host === "l.facebook.com" ||
      host.endsWith(".l.facebook.com");

    if (!isMetaRedirectHost) {
      return value;
    }

    const nestedUrl =
      parsed.searchParams.get("u") ??
      parsed.searchParams.get("url") ??
      parsed.searchParams.get("redirect_uri") ??
      "";

    if (!nestedUrl.trim()) {
      return value;
    }

    return safeDecodeURIComponent(nestedUrl).trim() || value;
  } catch {
    return value;
  }
}

function normalizeDestinationCandidate(value: string): string {
  let current = value.trim();
  if (!current) {
    return "";
  }

  for (let index = 0; index < 3; index += 1) {
    const next = unwrapMetaRedirectUrlOnce(current).trim();
    if (!next || next === current) {
      break;
    }

    current = next;
  }

  return current;
}

function collectDestinationCandidates(values: Array<string | undefined>): string[] {
  const candidates: string[] = [];

  for (const value of values) {
    if (typeof value !== "string" || !value.trim()) {
      continue;
    }

    const normalized = normalizeDestinationCandidate(value);
    if (normalized && !candidates.includes(normalized)) {
      candidates.push(normalized);
    }

    const trimmedOriginal = value.trim();
    if (trimmedOriginal && !candidates.includes(trimmedOriginal)) {
      candidates.push(trimmedOriginal);
    }
  }

  return candidates;
}

function looksLikeUrlSignal(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (isHttpUrl(trimmed)) {
    return true;
  }

  return /^((www\.)?([a-z0-9-]+\.)+[a-z]{2,})(\/|$)/i.test(trimmed);
}

function extractDestinationHintsFromUnknown(
  value: unknown,
  result: Set<string>,
  depth = 0
): void {
  if (depth > 6 || result.size >= 120 || value === null || value === undefined) {
    return;
  }

  if (typeof value === "string") {
    if (looksLikeUrlSignal(value)) {
      result.add(value.trim());
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      extractDestinationHintsFromUnknown(item, result, depth + 1);
    }
    return;
  }

  if (typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (typeof nestedValue === "string") {
        if (URL_HINT_KEY_PATTERN.test(key) && looksLikeUrlSignal(nestedValue)) {
          result.add(nestedValue.trim());
        }
        continue;
      }

      if (typeof nestedValue === "object" && nestedValue !== null) {
        if (URL_HINT_KEY_PATTERN.test(key) || depth <= 2) {
          extractDestinationHintsFromUnknown(nestedValue, result, depth + 1);
        }
      }
    }
  }
}

function collectCreativeDeepDestinationHints(
  creative: MetaAdCreativeResponseItem | undefined
): string[] {
  if (!creative) {
    return [];
  }

  const hints = new Set<string>();
  extractDestinationHintsFromUnknown(creative, hints);

  const normalizedHints = collectDestinationCandidates(Array.from(hints));
  return normalizedHints.filter((candidate) => !isLikelyCreativeAssetUrl(candidate));
}

function isTrafficObjectiveSignal(signal: string): boolean {
  return Boolean(signal) && getObjectiveCategory(signal) === "TRAFFIC";
}

function isTrafficDestinationContext(adSetContext?: MetaAdSetDestinationContext): boolean {
  if (!adSetContext) {
    return false;
  }

  if (isTrafficObjectiveSignal(adSetContext.objectiveSignal)) {
    return true;
  }

  return (
    adSetContext.destinationType.includes("WEBSITE") ||
    adSetContext.destinationType.includes("LANDING_PAGE") ||
    adSetContext.destinationType.includes("WEB")
  );
}

function isWebsiteDestinationUrl(value: string): boolean {
  return (
    isHttpUrl(value) &&
    !isWhatsAppUrl(value) &&
    !isMessengerUrl(value) &&
    !isInstagramDirectUrl(value) &&
    !isMetaOwnedUrl(value) &&
    !isLikelyCreativeAssetUrl(value)
  );
}

function looksLikeWebsiteUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  const normalized = trimmed.toLowerCase();
  if (
    normalized.startsWith("mailto:") ||
    normalized.startsWith("tel:") ||
    normalized.startsWith("sms:") ||
    normalized.startsWith("whatsapp:")
  ) {
    return false;
  }

  if (isWhatsAppUrl(trimmed) || isMessengerUrl(trimmed) || isInstagramDirectUrl(trimmed)) {
    return false;
  }

  if (isHttpUrl(trimmed)) {
    return !isMetaOwnedUrl(trimmed) && !isLikelyCreativeAssetUrl(trimmed);
  }

  const withoutProtocol = normalized.replace(/^https?:\/\//, "");
  return /^((www\.)?([a-z0-9-]+\.)+[a-z]{2,})(\/|$)/i.test(withoutProtocol);
}

function toDisplayableWebsiteUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (isHttpUrl(trimmed)) {
    return trimmed;
  }

  if (looksLikeWebsiteUrl(trimmed)) {
    return `https://${trimmed.replace(/^\/+/, "")}`;
  }

  return trimmed;
}

function normalizeWhatsAppNumber(value: string | undefined): string {
  if (typeof value !== "string") {
    return "";
  }

  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 ? digits : "";
}

function extractWhatsAppNumberFromUrl(value: string | undefined): string {
  if (!value || !isWhatsAppUrl(value)) {
    return "";
  }

  try {
    const parsed = new URL(value);
    const fromQuery =
      parsed.searchParams.get("phone") ??
      parsed.searchParams.get("phoneNumber") ??
      parsed.searchParams.get("whatsapp") ??
      "";

    const normalizedFromQuery = normalizeWhatsAppNumber(fromQuery);
    if (normalizedFromQuery) {
      return normalizedFromQuery;
    }

    const pathSegments = parsed.pathname.split("/").filter(Boolean);
    for (const segment of pathSegments.reverse()) {
      const normalizedSegment = normalizeWhatsAppNumber(segment);
      if (normalizedSegment) {
        return normalizedSegment;
      }
    }

    return "";
  } catch {
    return "";
  }
}

function extractWhatsAppNumberFromUnknown(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return normalizeWhatsAppNumber(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const number = extractWhatsAppNumberFromUnknown(item);
      if (number) {
        return number;
      }
    }
    return "";
  }

  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const normalizedKey = key.toLowerCase();
      if (
        normalizedKey.includes("whatsapp") ||
        normalizedKey.includes("phone") ||
        normalizedKey.includes("telephone")
      ) {
        const number = extractWhatsAppNumberFromUnknown(nested);
        if (number) {
          return number;
        }
      }
    }
  }

  return "";
}

function resolveWhatsAppNumberOverride(pageId: string): string {
  const rawOverrides = process.env.META_WHATSAPP_NUMBER_BY_PAGE_ID_JSON;
  if (!rawOverrides || !pageId) {
    return "";
  }

  try {
    const parsed = JSON.parse(rawOverrides) as Record<string, unknown>;
    const rawNumber = parsed[pageId];
    if (rawNumber === undefined || rawNumber === null) {
      return "";
    }

    return normalizeWhatsAppNumber(String(rawNumber));
  } catch {
    return "";
  }
}

function resolveWhatsAppNumberOverrideByAdSetId(adSetId: string): string {
  const rawOverrides = process.env.META_WHATSAPP_NUMBER_BY_ADSET_ID_JSON;
  if (!rawOverrides || !adSetId) {
    return "";
  }

  try {
    const parsed = JSON.parse(rawOverrides) as Record<string, unknown>;
    const rawNumber = parsed[adSetId];
    if (rawNumber === undefined || rawNumber === null) {
      return "";
    }

    return normalizeWhatsAppNumber(String(rawNumber));
  } catch {
    return "";
  }
}

function isMessagingCreative(
  creative: MetaAdCreativeResponseItem | undefined,
  adSetContext?: MetaAdSetDestinationContext
): boolean {
  const callToActions = collectCreativeCallToActions(creative);

  const signalParts = [
    adSetContext?.destinationType ?? "",
    normalizeSignal(creative?.call_to_action_type),
    ...(creative?.asset_feed_spec?.call_to_action_types ?? []).map(normalizeSignal),
    ...callToActions.map((cta) => normalizeSignal(cta.type)),
    ...callToActions.map((cta) => normalizeSignal(cta.value?.app_destination))
  ].filter(Boolean);

  const joinedSignals = signalParts.join(" ");
  return (
    joinedSignals.includes("MESSAGE") ||
    joinedSignals.includes("WHATSAPP") ||
    joinedSignals.includes("MESSENGER") ||
    joinedSignals.includes("INSTAGRAM_DIRECT")
  );
}

function resolveMessagingDestinationUrl(
  creative: MetaAdCreativeResponseItem | undefined,
  adSetContext?: MetaAdSetDestinationContext
): string {
  const callToActions = collectCreativeCallToActions(creative);
  const ctaLinks = collectCreativeCallToActionLinks(creative);
  const deepHintLinks = collectCreativeDeepDestinationHints(creative);

  const signalParts = [
    adSetContext?.destinationType ?? "",
    normalizeSignal(creative?.call_to_action_type),
    ...(creative?.asset_feed_spec?.call_to_action_types ?? []).map(normalizeSignal),
    ...callToActions.map((cta) => normalizeSignal(cta.type)),
    ...callToActions.map((cta) => normalizeSignal(cta.value?.app_destination))
  ].filter(Boolean);

  const joinedSignals = signalParts.join(" ");

  if (joinedSignals.includes("WHATSAPP") || Boolean(adSetContext?.whatsappNumber)) {
    const whatsappLink =
      [...ctaLinks, ...deepHintLinks].find((candidate) => isWhatsAppUrl(candidate)) ??
      [creative?.link_url, creative?.object_url].find(
        (candidate): candidate is string =>
          typeof candidate === "string" && isWhatsAppUrl(candidate)
      );

    if (whatsappLink) {
      return whatsappLink.trim();
    }

    const deepPhoneHint = extractWhatsAppNumberFromUnknown(creative);
    const whatsappNumber = [
      ...callToActions.map((cta) => cta.value?.whatsapp_number),
      ...callToActions.map((cta) => cta.value?.phone_number),
      ...ctaLinks.map((candidate) => extractWhatsAppNumberFromUrl(candidate)),
      ...deepHintLinks.map((candidate) => extractWhatsAppNumberFromUrl(candidate)),
      deepPhoneHint,
      adSetContext?.whatsappNumber
    ]
      .map(normalizeWhatsAppNumber)
      .find(Boolean);

    if (whatsappNumber) {
      return `https://wa.me/${whatsappNumber}`;
    }

    return "WhatsApp";
  }

  if (
    joinedSignals.includes("MESSENGER") ||
    joinedSignals.includes("MESSAGE_PAGE") ||
    (adSetContext?.destinationType.includes("MESSENGER") ?? false)
  ) {
    const messengerLink =
      ctaLinks.find((candidate) => isMessengerUrl(candidate)) ??
      [creative?.link_url, creative?.object_url].find(
        (candidate): candidate is string =>
          typeof candidate === "string" && isMessengerUrl(candidate)
      );

    if (messengerLink) {
      return messengerLink.trim();
    }

    if (adSetContext?.pageId) {
      return `https://m.me/${adSetContext.pageId}`;
    }

    return "Messenger (destino não identificado)";
  }

  if (joinedSignals.includes("INSTAGRAM_DIRECT")) {
    const instagramDirectLink =
      ctaLinks.find((candidate) => isInstagramDirectUrl(candidate)) ??
      [creative?.link_url, creative?.object_url].find(
        (candidate): candidate is string =>
          typeof candidate === "string" && isInstagramDirectUrl(candidate)
      );

    return instagramDirectLink?.trim() ?? "https://www.instagram.com/direct/inbox/";
  }

  const ctaLink =
    ctaLinks.find((candidate) => isWhatsAppUrl(candidate) || isMessengerUrl(candidate)) ??
    ctaLinks[0];

  if (ctaLink) {
    return ctaLink.trim();
  }

  return "";
}

function resolveCreativeDestinationUrl(
  creative: MetaAdCreativeResponseItem | undefined,
  adSetContext?: MetaAdSetDestinationContext
): string {
  const messagingDestinationUrl = resolveMessagingDestinationUrl(creative, adSetContext);
  if (messagingDestinationUrl) {
    return messagingDestinationUrl;
  }

  const objectStorySpec = creative?.object_story_spec;
  const linkData = objectStorySpec?.link_data;
  const childAttachmentLinks = (linkData?.child_attachments ?? [])
    .flatMap((attachment) => [attachment.link, attachment.call_to_action?.value?.link])
    .filter((link): link is string => typeof link === "string" && Boolean(link.trim()));
  const assetFeedLinks = (creative?.asset_feed_spec?.link_urls ?? [])
    .flatMap((item) => [item.website_url, item.url, item.deeplink_url])
    .filter((link): link is string => typeof link === "string" && Boolean(link.trim()));
  const storyId = creative?.effective_object_story_id ?? creative?.object_story_id;
  const storyUrl =
    typeof storyId === "string" && storyId.includes("_")
      ? `https://www.facebook.com/${storyId.replace("_", "/posts/")}`
      : "";
  const deepHintLinks = collectCreativeDeepDestinationHints(creative);

  const candidates = collectDestinationCandidates([
    ...collectCreativeCallToActionLinks(creative),
    objectStorySpec?.video_data?.call_to_action?.value?.link,
    objectStorySpec?.template_data?.link,
    linkData?.link,
    ...childAttachmentLinks,
    objectStorySpec?.photo_data?.link,
    ...assetFeedLinks,
    creative?.object_url,
    creative?.link_url,
    creative?.website_url,
    creative?.template_url,
    adSetContext?.websiteUrl
  ]);
  const enrichedCandidates = collectDestinationCandidates([
    ...candidates,
    ...deepHintLinks
  ]);

  if (isTrafficDestinationContext(adSetContext)) {
    const siteDestination = enrichedCandidates.find((candidate) => isWebsiteDestinationUrl(candidate));
    if (siteDestination) {
      return siteDestination;
    }

    const relaxedSiteDestination = enrichedCandidates.find((candidate) => looksLikeWebsiteUrl(candidate));
    if (relaxedSiteDestination) {
      return toDisplayableWebsiteUrl(relaxedSiteDestination);
    }

    const socialFallbackForTraffic = collectDestinationCandidates([
      creative?.instagram_permalink_url,
      storyUrl
    ]).find((candidate) => typeof candidate === "string" && candidate.trim());
    if (socialFallbackForTraffic) {
      return socialFallbackForTraffic.trim();
    }

    return "Site configurado na Meta Ads (URL não exposta pela API)";
  }

  for (const candidate of enrichedCandidates) {
    if (
      typeof candidate === "string" &&
      candidate.trim() &&
      !isLikelyCreativeAssetUrl(candidate) &&
      !isMetaOwnedUrl(candidate)
    ) {
      return candidate.trim();
    }
  }

  if (isMessagingCreative(creative, adSetContext)) {
    return "";
  }

  const socialFallbackCandidates = collectDestinationCandidates([
    creative?.instagram_permalink_url,
    storyUrl
  ]);
  for (const candidate of socialFallbackCandidates) {
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

async function isEmbeddablePreviewIframe(iframeUrl: string): Promise<boolean> {
  if (!iframeUrl) {
    return false;
  }

  if (isLikelyRestrictedIframeUrl(iframeUrl)) {
    return false;
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
      return false;
    }

    const html = await response.text();
    if (!html) {
      return true;
    }

    return !isRestrictedPreviewHtml(html);
  } catch {
    return false;
  }
}

function decodeAdPreviewBody(rawBody: string): string {
  return rawBody
    .replace(/\\\//g, "/")
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003a/gi, ":")
    .replace(/\\u002f/gi, "/")
    .replace(/\\u0025/gi, "%")
    .replace(/&amp;/g, "&");
}

function extractUrlCandidatesFromText(rawText: string): string[] {
  const matches = rawText.match(/https?:\/\/[^\s"'<>\\]+/gi) ?? [];
  return collectDestinationCandidates(matches);
}

function resolveDestinationFromAdPreviewBody(rawBody: string): string {
  const decodedBody = decodeAdPreviewBody(rawBody);
  const candidates = extractUrlCandidatesFromText(decodedBody);

  const whatsappCandidate = candidates.find((candidate) => isWhatsAppUrl(candidate));
  if (whatsappCandidate) {
    const whatsappNumber = extractWhatsAppNumberFromUrl(whatsappCandidate);
    if (whatsappNumber) {
      return `https://wa.me/${whatsappNumber}`;
    }
    return whatsappCandidate;
  }

  const websiteCandidate = candidates.find((candidate) => isWebsiteDestinationUrl(candidate));
  if (websiteCandidate) {
    return websiteCandidate;
  }

  const relaxedWebsiteCandidate = candidates.find((candidate) => looksLikeWebsiteUrl(candidate));
  if (relaxedWebsiteCandidate) {
    return toDisplayableWebsiteUrl(relaxedWebsiteCandidate);
  }

  const messengerCandidate = candidates.find((candidate) => isMessengerUrl(candidate));
  if (messengerCandidate) {
    return messengerCandidate;
  }

  return "";
}

function toDisplayDestinationLabel(destinationUrl: string): string {
  const trimmed = destinationUrl.trim();
  if (!trimmed) {
    return "";
  }

  if (
    trimmed === "WhatsApp (número não identificado)" ||
    trimmed === "WhatsApp" ||
    isWhatsAppUrl(trimmed) ||
    normalizeSignal(trimmed).includes("WHATSAPP")
  ) {
    return "WhatsApp";
  }

  return trimmed;
}

async function fetchDestinationFromAdPreview(adId: string): Promise<string> {
  for (const adFormat of AD_PREVIEW_FORMAT_CANDIDATES) {
    try {
      const previews = await fetchMetaList<MetaAdPreviewResponseItem>(`${adId}/previews`, {
        ad_format: adFormat,
        fields: "body",
        limit: "1"
      });

      for (const preview of previews) {
        const body = typeof preview.body === "string" ? preview.body.trim() : "";
        if (!body) {
          continue;
        }

        const destinationFromBody = resolveDestinationFromAdPreviewBody(body);
        if (destinationFromBody) {
          return destinationFromBody;
        }
      }
    } catch (error) {
      if (isAdPreviewFormatValidationError(error)) {
        continue;
      }

      throw error;
    }
  }

  return "";
}

function collectStoryAttachmentLinks(
  attachments: MetaStoryAttachmentItem[] | undefined,
  collector: string[]
): void {
  if (!attachments?.length) {
    return;
  }

  for (const attachment of attachments) {
    collector.push(attachment.unshimmed_url ?? "", attachment.url ?? "", attachment.target?.url ?? "");
    if (attachment.subattachments?.data?.length) {
      collectStoryAttachmentLinks(attachment.subattachments.data, collector);
    }
  }
}

function resolveDestinationFromStoryPayload(story: MetaStoryResponseItem): string {
  const rawCandidates: string[] = [story.permalink_url ?? ""];
  collectStoryAttachmentLinks(story.attachments?.data, rawCandidates);

  const candidates = collectDestinationCandidates(rawCandidates);
  const websiteCandidate = candidates.find((candidate) => isWebsiteDestinationUrl(candidate));
  if (websiteCandidate) {
    return websiteCandidate;
  }

  const relaxedWebsiteCandidate = candidates.find((candidate) => looksLikeWebsiteUrl(candidate));
  if (relaxedWebsiteCandidate) {
    return toDisplayableWebsiteUrl(relaxedWebsiteCandidate);
  }

  const whatsappCandidate = candidates.find((candidate) => isWhatsAppUrl(candidate));
  if (whatsappCandidate) {
    const whatsappNumber = extractWhatsAppNumberFromUrl(whatsappCandidate);
    return whatsappNumber ? `https://wa.me/${whatsappNumber}` : whatsappCandidate;
  }

  const messengerCandidate = candidates.find((candidate) => isMessengerUrl(candidate));
  if (messengerCandidate) {
    return messengerCandidate;
  }

  return "";
}

async function fetchDestinationFromStoryId(storyId: string): Promise<string> {
  if (!storyId) {
    return "";
  }

  try {
    const story = await fetchMetaObject<MetaStoryResponseItem>(storyId, {
      fields:
        "id,permalink_url,attachments{url,unshimmed_url,target{url},subattachments{url,unshimmed_url,target{url}}}"
    });

    return resolveDestinationFromStoryPayload(story);
  } catch {
    return "";
  }
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

function hasNonEmptyString(value: string | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

function countChildAttachmentLinks(
  attachments:
    | Array<{
        link?: string;
        call_to_action?: MetaAdCreativeCallToAction;
      }>
    | undefined
): number {
  if (!attachments?.length) {
    return 0;
  }

  return attachments.reduce((count, attachment) => {
    if (hasNonEmptyString(attachment.link) || hasNonEmptyString(attachment.call_to_action?.value?.link)) {
      return count + 1;
    }

    return count;
  }, 0);
}

function countAssetFeedLinks(
  links: MetaAdCreativeAssetFeedLinkUrl[] | undefined
): number {
  if (!links?.length) {
    return 0;
  }

  return links.reduce((count, entry) => {
    if (
      hasNonEmptyString(entry.website_url) ||
      hasNonEmptyString(entry.url) ||
      hasNonEmptyString(entry.deeplink_url)
    ) {
      return count + 1;
    }

    return count;
  }, 0);
}

function resolveDestinationDiagnosticReason(destinationUrl: string): string | null {
  if (!destinationUrl) {
    return "EMPTY_DESTINATION";
  }

  if (destinationUrl === "Site configurado na Meta Ads (URL não exposta pela API)") {
    return "TRAFFIC_URL_NOT_EXPOSED";
  }

  if (destinationUrl === "WhatsApp" || destinationUrl === "WhatsApp (número não identificado)") {
    return "WHATSAPP_NUMBER_NOT_IDENTIFIED";
  }

  if (destinationUrl === "Messenger (destino não identificado)") {
    return "MESSENGER_TARGET_NOT_IDENTIFIED";
  }

  return null;
}

function logDestinationDiagnostic(params: {
  ad: MetaAdResponseItem;
  destinationContext: MetaAdSetDestinationContext;
  resolvedDestinationUrl: string;
}): void {
  if (!DESTINATION_DIAGNOSTIC_ENABLED) {
    return;
  }

  const reason = resolveDestinationDiagnosticReason(params.resolvedDestinationUrl);
  if (!reason) {
    return;
  }

  const { ad, destinationContext, resolvedDestinationUrl } = params;
  const creative = ad.creative;
  const objectStorySpec = creative?.object_story_spec;

  const payload = {
    adId: ad.id,
    adName: ad.name,
    campaignId: ad.campaign_id ?? "",
    adSetId: resolveAdSetId(ad),
    reason,
    resolvedDestinationUrl,
    destinationSignals: {
      destinationType: destinationContext.destinationType || "NONE",
      objectiveSignal: destinationContext.objectiveSignal || "NONE",
      callToActionType: normalizeSignal(ad.call_to_action_type)
    },
    sourcePresence: {
      creativeId: resolveCreativeId(creative),
      creativeName: resolveCreativeName(creative),
      creativeLinkUrl: hasNonEmptyString(creative?.link_url),
      creativeObjectUrl: hasNonEmptyString(creative?.object_url),
      creativeInstagramPermalink: hasNonEmptyString(creative?.instagram_permalink_url),
      storyLinkDataLink: hasNonEmptyString(objectStorySpec?.link_data?.link),
      storyPhotoLink: hasNonEmptyString(objectStorySpec?.photo_data?.link),
      storyTemplateLink: hasNonEmptyString(objectStorySpec?.template_data?.link),
      storyVideoCtaLink: hasNonEmptyString(objectStorySpec?.video_data?.call_to_action?.value?.link),
      childAttachmentLinks: countChildAttachmentLinks(
        objectStorySpec?.link_data?.child_attachments
      ),
      creativeCtaLinks: collectCreativeCallToActionLinks(creative).length,
      assetFeedLinks: countAssetFeedLinks(creative?.asset_feed_spec?.link_urls),
      adPromotedObjectLink: hasNonEmptyString(ad.promoted_object?.link),
      adPromotedObjectWebsiteUrl: hasNonEmptyString(ad.promoted_object?.website_url),
      adPromotedObjectCustomUrl: hasNonEmptyString(ad.promoted_object?.custom_url),
      adSetWebsiteUrl: hasNonEmptyString(destinationContext.websiteUrl),
      adSetWhatsAppNumber: hasNonEmptyString(destinationContext.whatsappNumber),
      adSetPageId: hasNonEmptyString(destinationContext.pageId)
    }
  };

  console.info("[meta-api][destination-diagnostic]", JSON.stringify(payload));
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
  adSetIdFromContext: string,
  adSetContext?: MetaAdSetDestinationContext
): MetaAd {
  const creative = item.creative;
  const adSetId = resolveAdSetId(item) || adSetIdFromContext;
  const destinationContext = mergeDestinationContext(
    adSetContext,
    item.destination_type,
    item.promoted_object,
    item.call_to_action_type
  );
  const destinationUrl = resolveCreativeDestinationUrl(creative, destinationContext);

  logDestinationDiagnostic({
    ad: {
      ...item,
      adset_id: adSetId
    },
    destinationContext,
    resolvedDestinationUrl: destinationUrl
  });

  return {
    id: item.id,
    name: item.name,
    campaignId: item.campaign_id ?? "",
    adSetId,
    effectiveStatus: item.effective_status ?? "UNKNOWN",
    configuredStatus: resolveConfiguredStatus(item.status, item.configured_status),
    creativeId: resolveCreativeId(creative),
    creativeName: resolveCreativeName(creative),
    creativePreviewUrl: resolveCreativePreviewUrl(creative),
    destinationUrl
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

async function fetchAdSetDestinationContext(
  adSetId: string
): Promise<MetaAdSetDestinationContext> {
  try {
    const adSet = await fetchMetaObject<MetaAdSetDestinationResponseItem>(adSetId, {
      fields: "id,destination_type,promoted_object,campaign{objective}"
    });

    const context = createAdSetDestinationContext(adSet);
    if (!context.whatsappNumber) {
      const adSetOverrideWhatsApp = resolveWhatsAppNumberOverrideByAdSetId(adSetId);
      if (adSetOverrideWhatsApp) {
        return {
          ...context,
          whatsappNumber: adSetOverrideWhatsApp
        };
      }
    }

    if (
      context.whatsappNumber ||
      !context.pageId ||
      !context.destinationType.includes("WHATSAPP")
    ) {
      return context;
    }

    const overrideWhatsAppNumber = resolveWhatsAppNumberOverride(context.pageId);
    if (overrideWhatsAppNumber) {
      return {
        ...context,
        whatsappNumber: overrideWhatsAppNumber
      };
    }

    try {
      const page = await fetchMetaObject<MetaPageMessagingResponseItem>(context.pageId, {
        fields: "id,whatsapp_number,whatsapp_phone_number,linked_whatsapp_phone_number,phone"
      });

      const pageWhatsAppNumber =
        normalizeWhatsAppNumber(page.whatsapp_number) ||
        normalizeWhatsAppNumber(page.whatsapp_phone_number) ||
        normalizeWhatsAppNumber(page.linked_whatsapp_phone_number) ||
        normalizeWhatsAppNumber(page.phone);

      return {
        ...context,
        whatsappNumber: pageWhatsAppNumber || context.whatsappNumber
      };
    } catch {
      return context;
    }
  } catch {
    return createAdSetDestinationContext(null);
  }
}

async function fetchAdCreativeById(
  creativeId: string
): Promise<MetaAdCreativeResponseItem | null> {
  if (!creativeId) {
    return null;
  }

  try {
    const creative = await fetchMetaObject<MetaAdCreativeResponseItem>(creativeId, {
      fields: CREATIVE_FIELDS
    });

    if (!creative || typeof creative !== "object") {
      return null;
    }

    return creative;
  } catch {
    return null;
  }
}

function shouldRefineDestination(destinationUrl: string): boolean {
  return (
    !destinationUrl ||
    destinationUrl === "Site configurado na Meta Ads (URL não exposta pela API)" ||
    destinationUrl === "WhatsApp" ||
    destinationUrl === "WhatsApp (número não identificado)" ||
    destinationUrl === "Messenger (destino não identificado)"
  );
}

export async function fetchAdSetAds(adSetId: string): Promise<MetaAd[]> {
  const [ads, adSetContext] = await Promise.all([
    fetchMetaList<MetaAdResponseItem>(`${adSetId}/ads`, {
      fields: `id,name,campaign_id,adset_id,destination_type,call_to_action_type,promoted_object,effective_status,status,configured_status,creative{${CREATIVE_FIELDS}}`,
      limit: "5000"
    }),
    fetchAdSetDestinationContext(adSetId)
  ]);

  const rawAdById = new Map(ads.map((ad) => [ad.id, ad]));
  const normalizedAds = ads
    .filter((ad) => Boolean(ad.id && ad.name))
    .map((ad) => normalizeAd(ad, adSetId, adSetContext))
    .sort((a, b) => a.name.localeCompare(b.name));

  const creativeRequestById = new Map<string, Promise<MetaAdCreativeResponseItem | null>>();
  const refinedAds = await Promise.all(
    normalizedAds.map(async (ad) => {
      if (!ad.creativeId || !shouldRefineDestination(ad.destinationUrl)) {
        return ad;
      }

      const rawAd = rawAdById.get(ad.id);
      if (!rawAd) {
        return ad;
      }

      let creativeRequest = creativeRequestById.get(ad.creativeId);
      if (!creativeRequest) {
        creativeRequest = fetchAdCreativeById(ad.creativeId);
        creativeRequestById.set(ad.creativeId, creativeRequest);
      }

      const creative = await creativeRequest;
      if (!creative) {
        return ad;
      }

      const resolvedDestination = resolveCreativeDestinationUrl(creative, adSetContext);
      if (!resolvedDestination || resolvedDestination === ad.destinationUrl) {
        return ad;
      }

      return {
        ...ad,
        destinationUrl: resolvedDestination,
        creativeName:
          ad.creativeName === "Criativo não identificado" ? resolveCreativeName(creative) : ad.creativeName,
        creativePreviewUrl: ad.creativePreviewUrl || resolveCreativePreviewUrl(creative)
      };
    })
  );

  const previewRefinedAds = DESTINATION_PREVIEW_FALLBACK_ENABLED
    ? await Promise.all(
        refinedAds.map(async (ad) => {
          if (!shouldRefineDestination(ad.destinationUrl)) {
            return ad;
          }

          const destinationFromPreview = await fetchDestinationFromAdPreview(ad.id);
          if (!destinationFromPreview || destinationFromPreview === ad.destinationUrl) {
            return ad;
          }

          return {
            ...ad,
            destinationUrl: destinationFromPreview
          };
        })
      )
    : refinedAds;

  const storyDestinationById = new Map<string, Promise<string>>();
  const storyRefinedAds = await Promise.all(
    previewRefinedAds.map(async (ad) => {
      if (!shouldRefineDestination(ad.destinationUrl)) {
        return ad;
      }

      const rawAd = rawAdById.get(ad.id);
      const storyId =
        rawAd?.creative?.effective_object_story_id ?? rawAd?.creative?.object_story_id ?? "";
      if (!storyId) {
        return ad;
      }

      let storyRequest = storyDestinationById.get(storyId);
      if (!storyRequest) {
        storyRequest = fetchDestinationFromStoryId(storyId);
        storyDestinationById.set(storyId, storyRequest);
      }

      const destinationFromStory = await storyRequest;
      if (!destinationFromStory || destinationFromStory === ad.destinationUrl) {
        return ad;
      }

      return {
        ...ad,
        destinationUrl: destinationFromStory
      };
    })
  );

  const adSetHasWhatsAppDestination =
    Boolean(adSetContext.whatsappNumber) ||
    adSetContext.destinationType.includes("WHATSAPP") ||
    storyRefinedAds.some(
      (ad) =>
        isWhatsAppUrl(ad.destinationUrl) ||
        normalizeSignal(ad.destinationUrl).includes("WHATSAPP")
    );

  const displayAds = storyRefinedAds.map((ad) => ({
    ...ad,
    destinationUrl: toDisplayDestinationLabel(ad.destinationUrl)
  }));

  if (!adSetHasWhatsAppDestination) {
    return displayAds;
  }

  const defaultWhatsAppDestination = "WhatsApp";

  return displayAds.map((ad) => {
    if (!ad.destinationUrl || isSocialPostUrl(ad.destinationUrl)) {
      return {
        ...ad,
        destinationUrl: defaultWhatsAppDestination
      };
    }

    return ad;
  });
}

export async function fetchAdPreview(adId: string): Promise<MetaAdPreview> {
  let firstError: Error | null = null;

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

      if (iframeUrl && (await isEmbeddablePreviewIframe(iframeUrl))) {
        return {
          adId,
          adFormat,
          iframeUrl
        };
      }
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
