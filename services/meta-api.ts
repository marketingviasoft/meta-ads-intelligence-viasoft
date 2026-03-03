import type {
  DeliveryStatus,
  MetaAd,
  MetaAdPreview,
  MetaAdSet,
  MetaCampaign,
  NormalizedInsightRow
} from "@/lib/types";
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
};

type MetaPageMessagingResponseItem = {
  id?: string;
  whatsapp_number?: string;
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
};

type MetaInsightAction = {
  action_type: string;
  value: string;
};

type MetaInsightResponseItem = {
  date_start: string;
  date_stop: string;
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  conversions?: string;
  actions?: MetaInsightAction[];
  cost_per_action_type?: MetaInsightAction[];
};

type AdSetWithoutDeliveryReason = "COMPLETED" | "ADSET_DISABLED" | "UNKNOWN";

const FALLBACK_VERTICAL_TAG = "Sem vertical";

const GRAPH_API_BASE = "https://graph.facebook.com";
const META_RATE_LIMIT_COOLDOWN_MS = 60 * 1000;
let metaRateLimitUntilMs = 0;
const AUTO_GENERATED_CREATIVE_SUFFIX_PATTERN = /\s+\d{4}-\d{2}-\d{2}-[a-f0-9]{16,}$/i;
const AD_PREVIEW_FORMAT_CANDIDATES = [
  "DESKTOP_FEED_STANDARD",
  "MOBILE_FEED_STANDARD",
  "INSTAGRAM_STANDARD"
] as const;
const INSIGHT_FIELDS = [
  "spend",
  "impressions",
  "clicks",
  "ctr",
  "cpc",
  "conversions",
  "actions",
  "cost_per_action_type",
  "date_start",
  "date_stop"
].join(",");

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

async function fetchMetaList<T>(path: string, queryParams: Record<string, string>): Promise<T[]> {
  assertMetaRateLimitCooldown();

  const items: T[] = [];
  let nextUrl: string | null = buildUrl(path, queryParams);
  let safetyPageCounter = 0;

  while (nextUrl) {
    if (safetyPageCounter >= 60) {
      throw new Error("Meta API: paginação excedeu o limite de segurança (60 páginas).");
    }

    const response = await fetch(nextUrl, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw await buildMetaHttpError(response);
    }

    const payload = (await response.json()) as MetaApiListResponse<T>;

    if (payload.error) {
      if (payload.error.code === 17) {
        startMetaRateLimitCooldown();
      }

      throw new Error(`Meta API: ${payload.error.message}`);
    }

    items.push(...(payload.data ?? []));
    nextUrl = payload.paging?.next ?? null;
    safetyPageCounter += 1;
  }

  return items;
}

async function fetchMetaObject<T>(path: string, queryParams: Record<string, string>): Promise<T> {
  assertMetaRateLimitCooldown();

  const url = buildUrl(path, queryParams);

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    throw await buildMetaHttpError(response);
  }

  const payload = (await response.json()) as T & {
    error?: MetaApiError;
  };

  if (payload.error) {
    if (payload.error.code === 17) {
      startMetaRateLimitCooldown();
    }

    throw new Error(`Meta API: ${payload.error.message}`);
  }

  return payload;
}

function normalizeCampaign(
  item: MetaCampaignResponseItem,
  deliveryStatus: DeliveryStatus
): MetaCampaign {
  const verticalTag = extractVerticalTag(item.name);

  return {
    id: item.id,
    name: item.name,
    objective: item.objective,
    objectiveCategory: getObjectiveCategory(item.objective),
    effectiveStatus: item.effective_status ?? "UNKNOWN",
    verticalTag,
    deliveryStatus
  };
}

function extractVerticalTag(campaignName: string): string {
  const match = campaignName.match(/^\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*/u);

  if (!match) {
    return FALLBACK_VERTICAL_TAG;
  }

  const parsedVertical = match[2]?.trim();
  return parsedVertical || FALLBACK_VERTICAL_TAG;
}

function normalizeInsightRow(item: MetaInsightResponseItem): NormalizedInsightRow {
  const spend = toNumber(item.spend);
  const impressions = toNumber(item.impressions);
  const clicks = toNumber(item.clicks);

  return {
    dateStart: item.date_start,
    dateStop: item.date_stop,
    spend,
    impressions,
    clicks,
    ctr: toNumber(item.ctr),
    cpc: toNumber(item.cpc),
    conversions: toNumber(item.conversions),
    actions: parseActionMap(item.actions),
    costPerActionType: parseActionMap(item.cost_per_action_type)
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
  return {
    destinationType: normalizeSignal(adSet?.destination_type),
    whatsappNumber:
      normalizeWhatsAppNumber(adSet?.promoted_object?.whatsapp_number) ||
      normalizeWhatsAppNumber(adSet?.promoted_object?.whatsapp_phone_number),
    pageId: typeof adSet?.promoted_object?.page_id === "string" ? adSet.promoted_object.page_id : "",
    objectiveSignal: normalizeSignal(adSet?.campaign?.objective)
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

  return {
    destinationType: [normalizedDestinationType, normalizedCallToActionType, adSetContext?.destinationType]
      .filter(Boolean)
      .join(" "),
    whatsappNumber: promotedWhatsAppNumber || adSetContext?.whatsappNumber || "",
    pageId: promotedPageId || adSetContext?.pageId || "",
    objectiveSignal: adSetContext?.objectiveSignal || ""
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

function isMetaSocialUrl(value: string): boolean {
  if (!isHttpUrl(value)) {
    return false;
  }

  try {
    return isMetaSocialHost(new URL(value).hostname);
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
    !isMetaSocialUrl(value)
  );
}

function normalizeWhatsAppNumber(value: string | undefined): string {
  if (typeof value !== "string") {
    return "";
  }

  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 ? digits : "";
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
      ctaLinks.find((candidate) => isWhatsAppUrl(candidate)) ??
      [creative?.link_url, creative?.object_url].find(
        (candidate): candidate is string =>
          typeof candidate === "string" && isWhatsAppUrl(candidate)
      );

    if (whatsappLink) {
      return whatsappLink.trim();
    }

    const whatsappNumber = [
      ...callToActions.map((cta) => cta.value?.whatsapp_number),
      ...callToActions.map((cta) => cta.value?.phone_number),
      adSetContext?.whatsappNumber
    ]
      .map(normalizeWhatsAppNumber)
      .find(Boolean);

    if (whatsappNumber) {
      return `https://wa.me/${whatsappNumber}`;
    }

    return "WhatsApp (número não identificado)";
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
    .map((attachment) => attachment.link)
    .filter((link): link is string => typeof link === "string" && Boolean(link.trim()));
  const assetFeedLinks = (creative?.asset_feed_spec?.link_urls ?? [])
    .flatMap((item) => [item.website_url, item.url, item.deeplink_url])
    .filter((link): link is string => typeof link === "string" && Boolean(link.trim()));
  const storyId = creative?.effective_object_story_id ?? creative?.object_story_id;
  const storyUrl =
    typeof storyId === "string" && storyId.includes("_")
      ? `https://www.facebook.com/${storyId.replace("_", "/posts/")}`
      : "";

  const candidates = collectDestinationCandidates([
    ...collectCreativeCallToActionLinks(creative),
    objectStorySpec?.video_data?.call_to_action?.value?.link,
    objectStorySpec?.template_data?.link,
    linkData?.link,
    ...childAttachmentLinks,
    objectStorySpec?.photo_data?.link,
    ...assetFeedLinks,
    creative?.object_url,
    creative?.link_url
  ]);

  if (isTrafficDestinationContext(adSetContext)) {
    const siteDestination = candidates.find((candidate) => isWebsiteDestinationUrl(candidate));
    if (siteDestination) {
      return siteDestination;
    }

    return "Site (URL não identificado)";
  }

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
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
  const destinationContext = mergeDestinationContext(
    adSetContext,
    item.destination_type,
    item.promoted_object,
    item.call_to_action_type
  );

  return {
    id: item.id,
    name: item.name,
    campaignId: item.campaign_id ?? "",
    adSetId: resolveAdSetId(item) || adSetIdFromContext,
    effectiveStatus: item.effective_status ?? "UNKNOWN",
    configuredStatus: resolveConfiguredStatus(item.status, item.configured_status),
    creativeId: resolveCreativeId(creative),
    creativeName: resolveCreativeName(creative),
    creativePreviewUrl: resolveCreativePreviewUrl(creative),
    destinationUrl: resolveCreativeDestinationUrl(creative, destinationContext)
  };
}

function isAdDeliveringActive(item: MetaAdResponseItem): boolean {
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

async function resolveCampaignDeliveryStatus(campaignId: string): Promise<DeliveryStatus> {
  const adsets = await fetchMetaList<MetaAdSetDeliveryResponseItem>(`${campaignId}/adsets`, {
    fields: "effective_status,status,configured_status,end_time",
    limit: "5000"
  });

  return resolveCampaignDeliveryStatusFromAdSets(adsets);
}

export async function fetchActiveCampaigns(): Promise<MetaCampaign[]> {
  const { adAccountId } = getMetaConfig();

  const [campaigns, campaignDeliveryAdSets] = await Promise.all([
    fetchMetaList<MetaCampaignResponseItem>(`${adAccountId}/campaigns`, {
      fields: "id,name,objective,effective_status,status",
      limit: "200"
    }),
    fetchMetaList<MetaAdSetDeliveryResponseItem>(`${adAccountId}/adsets`, {
      fields: "campaign_id,campaign{id},effective_status,status,configured_status,end_time",
      limit: "5000"
    })
  ]);
  const campaignDeliveryStatus = mapCampaignDeliveryStatus(campaignDeliveryAdSets);

  return campaigns
    .filter((campaign) => isStatusActive(campaign.effective_status))
    .map((campaign) =>
      normalizeCampaign(
        campaign,
        campaignDeliveryStatus.get(campaign.id) ?? "WITHOUT_DELIVERY"
      )
    )
    .filter((campaign) => campaign.deliveryStatus === "ACTIVE")
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchCampaignById(campaignId: string): Promise<MetaCampaign | null> {
  const campaign = await fetchMetaObject<MetaCampaignResponseItem>(campaignId, {
    fields: "id,name,objective,effective_status,status"
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
    .filter((adSet) => isAdSetDeliveringActive(adSet))
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
        fields: "id,whatsapp_number,phone"
      });

      const pageWhatsAppNumber =
        normalizeWhatsAppNumber(page.whatsapp_number) || normalizeWhatsAppNumber(page.phone);

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

export async function fetchAdSetAds(adSetId: string): Promise<MetaAd[]> {
  const [ads, adSetContext] = await Promise.all([
    fetchMetaList<MetaAdResponseItem>(`${adSetId}/ads`, {
      fields:
        "id,name,campaign_id,adset_id,destination_type,call_to_action_type,promoted_object,effective_status,status,configured_status,creative{id,name,call_to_action_type,thumbnail_url,image_url,object_url,link_url,object_story_id,effective_object_story_id,instagram_permalink_url,object_story_spec,asset_feed_spec}",
      limit: "5000"
    }),
    fetchAdSetDestinationContext(adSetId)
  ]);

  const normalizedAds = ads
    .filter((ad) => Boolean(ad.id && ad.name))
    .filter((ad) => isAdDeliveringActive(ad))
    .map((ad) => normalizeAd(ad, adSetId, adSetContext))
    .sort((a, b) => a.name.localeCompare(b.name));

  const adSetHasWhatsAppDestination =
    Boolean(adSetContext.whatsappNumber) ||
    adSetContext.destinationType.includes("WHATSAPP") ||
    normalizedAds.some(
      (ad) =>
        isWhatsAppUrl(ad.destinationUrl) ||
        normalizeSignal(ad.destinationUrl).includes("WHATSAPP")
    );

  if (!adSetHasWhatsAppDestination) {
    return normalizedAds;
  }

  const defaultWhatsAppDestination = adSetContext.whatsappNumber
    ? `https://wa.me/${adSetContext.whatsappNumber}`
    : "WhatsApp (número não identificado)";

  return normalizedAds.map((ad) => {
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

      if (iframeUrl) {
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

export async function fetchCampaignInsights(params: {
  campaignId: string;
  since: string;
  until: string;
  timeIncrement?: 1;
}): Promise<NormalizedInsightRow[]> {
  const { campaignId, since, until, timeIncrement } = params;

  const queryParams: Record<string, string> = {
    fields: INSIGHT_FIELDS,
    level: "campaign",
    time_range: JSON.stringify({
      since,
      until
    }),
    limit: "5000"
  };

  if (timeIncrement) {
    queryParams.time_increment = String(timeIncrement);
  }

  const insights = await fetchMetaList<MetaInsightResponseItem>(`${campaignId}/insights`, queryParams);

  return insights.map(normalizeInsightRow);
}
