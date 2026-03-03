export const FALLBACK_VERTICAL_TAG = "Sem vertical";

export function extractVerticalTagFromCampaignName(campaignName: string): string {
  const match = campaignName.match(/^\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*/u);

  if (!match) {
    return FALLBACK_VERTICAL_TAG;
  }

  const parsedVertical = match[2]?.trim();
  return parsedVertical || FALLBACK_VERTICAL_TAG;
}
