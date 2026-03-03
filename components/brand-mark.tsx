import type { CSSProperties } from "react";

type BrandMarkVariant = "icon" | "logo";

type BrandMarkProps = {
  variant?: BrandMarkVariant;
  size?: number;
  width?: number;
  height?: number;
  className?: string;
};

const BRAND_ASSET_PATH: Record<BrandMarkVariant, string> = {
  // Branding institucional (header, PDF e identidade visual) usa apenas assets de /public/logos.
  // Ícones de /public/icons/verticais ficam exclusivos para a lista de verticais.
  icon: "/logos/viasoft-icon.svg",
  logo: "/logos/viasoft-logo.svg"
};

const LOGO_ASPECT_RATIO = 512 / 62.302;

export function BrandMark({
  variant = "icon",
  size = 18,
  width,
  height,
  className = ""
}: BrandMarkProps) {
  const resolvedHeight = height ?? size;
  const resolvedWidth = width ?? (variant === "logo" ? resolvedHeight * LOGO_ASPECT_RATIO : size);
  const assetPath = BRAND_ASSET_PATH[variant];

  const style: CSSProperties = {
    width: `${resolvedWidth}px`,
    height: `${resolvedHeight}px`,
    WebkitMaskImage: `url(${assetPath})`,
    maskImage: `url(${assetPath})`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain"
  };

  return <span aria-hidden className={`inline-block bg-current ${className}`} style={style} />;
}
