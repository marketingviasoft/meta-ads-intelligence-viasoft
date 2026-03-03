import type { LucideIcon } from "lucide-react";
import { CircleHelp } from "lucide-react";

type VerticalUi = {
  iconSrc?: string;
  icon?: LucideIcon;
  chipClassName: string;
  iconClassName?: string;
};

type VerticalMatcher = {
  keywords: string[];
  ui: VerticalUi;
};

const ICON_BASE_PATH = "/icons/verticais";
const STANDARD_CHIP_TONE = "bg-viasoft/10 text-viasoft";

const DEFAULT_VERTICAL_UI: VerticalUi = {
  icon: CircleHelp,
  chipClassName: STANDARD_CHIP_TONE,
  iconClassName: "text-viasoft"
};

const VERTICAL_MATCHERS: VerticalMatcher[] = [
  {
    keywords: ["analytics"],
    ui: {
      iconSrc: `${ICON_BASE_PATH}/analytics.svg`,
      chipClassName: STANDARD_CHIP_TONE
    }
  },
  {
    keywords: ["agro", "agrotitan"],
    ui: {
      iconSrc: `${ICON_BASE_PATH}/agrotitan.svg`,
      chipClassName: STANDARD_CHIP_TONE
    }
  },
  {
    keywords: ["constr", "construshow"],
    ui: {
      iconSrc: `${ICON_BASE_PATH}/construshow.svg`,
      chipClassName: STANDARD_CHIP_TONE
    }
  },
  {
    keywords: ["petro", "petroshow"],
    ui: {
      iconSrc: `${ICON_BASE_PATH}/petroshow.svg`,
      chipClassName: STANDARD_CHIP_TONE
    }
  },
  {
    keywords: ["filt"],
    ui: {
      iconSrc: `${ICON_BASE_PATH}/filt.svg`,
      chipClassName: STANDARD_CHIP_TONE
    }
  },
  {
    keywords: ["voors"],
    ui: {
      iconSrc: `${ICON_BASE_PATH}/voors.svg`,
      chipClassName: STANDARD_CHIP_TONE
    }
  },
  {
    keywords: ["crm"],
    ui: {
      iconSrc: `${ICON_BASE_PATH}/crm.svg`,
      chipClassName: STANDARD_CHIP_TONE
    }
  },
  {
    keywords: ["viasoft", "via soft"],
    ui: {
      iconSrc: `${ICON_BASE_PATH}/viasoft.svg`,
      chipClassName: STANDARD_CHIP_TONE
    }
  }
];

function normalizeVertical(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function getVerticalUi(verticalLabel: string): VerticalUi {
  const normalized = normalizeVertical(verticalLabel);

  for (const matcher of VERTICAL_MATCHERS) {
    if (matcher.keywords.some((keyword) => normalized.includes(keyword))) {
      return matcher.ui;
    }
  }

  return DEFAULT_VERTICAL_UI;
}
