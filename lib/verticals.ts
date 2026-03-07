export const SUPPORTED_VERTICALS = [
  "VIASOFT",
  "Agrotitan",
  "Construshow",
  "Filt",
  "Petroshow",
  "Voors"
] as const;

export type SupportedVertical = (typeof SUPPORTED_VERTICALS)[number];

export function resolveSupportedVertical(input: string): SupportedVertical | null {
  const normalized = input.trim();

  for (const vertical of SUPPORTED_VERTICALS) {
    if (vertical.localeCompare(normalized, "pt-BR", { sensitivity: "base" }) === 0) {
      return vertical;
    }
  }

  return null;
}
