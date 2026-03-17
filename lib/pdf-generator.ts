import type { RangeDays } from "@/lib/types";
import { getSharedBrowser } from "@/lib/browser-launcher";
import { PDF_VIEWPORT } from "@/pdf/layout-preset";
import { isValidRangeDays } from "@/utils/date-range";

export async function generateDashboardPdf(params: {
  baseUrl: string;
  campaignId?: string;
  verticalTag?: string;
  deliveryGroup?: string;
  selectedAdSetId?: string;
  compareAdSetIds?: string;
  compareAdIds?: string;
  rangeDays: RangeDays;
}): Promise<Uint8Array> {
  const {
    baseUrl,
    campaignId,
    verticalTag,
    deliveryGroup,
    selectedAdSetId,
    compareAdSetIds,
    compareAdIds,
    rangeDays
  } = params;

  if (!isValidRangeDays(rangeDays)) {
    throw new Error("Período inválido para PDF");
  }

  if (!campaignId && !verticalTag) {
    throw new Error("Informe campaignId ou verticalTag para gerar o PDF");
  }

  const query = new URLSearchParams({
    rangeDays: String(rangeDays)
  });

  if (campaignId) {
    query.set("campaignId", campaignId);
  }

  if (verticalTag) {
    query.set("verticalTag", verticalTag);
  }

  if (deliveryGroup) {
    query.set("deliveryGroup", deliveryGroup);
  }

  if (selectedAdSetId) {
    query.set("selectedAdSetId", selectedAdSetId);
  }

  if (compareAdSetIds) {
    query.set("compareAdSetIds", compareAdSetIds);
  }

  if (compareAdIds) {
    query.set("compareAdIds", compareAdIds);
  }

  const printUrl = `${baseUrl}/pdf?${query.toString()}`;

  const browser = await getSharedBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({
      width: PDF_VIEWPORT.width,
      height: PDF_VIEWPORT.height,
      deviceScaleFactor: 1
    });

    await page.goto(printUrl, {
      waitUntil: "domcontentloaded",
      timeout: 120000
    });

    await page.addStyleTag({
      content: `
        nextjs-portal,
        #__next-build-watcher,
        [data-nextjs-dev-tools-button],
        [data-nextjs-toast],
        [data-next-badge-root] {
          display: none !important;
          visibility: hidden !important;
        }
      `
    });

    await page.evaluate(() => {
      document.querySelectorAll("nextjs-portal").forEach((node) => {
        node.remove();
      });
    });

    await page
      .waitForSelector("body[data-pdf-ready='true']", {
        timeout: 7000
      })
      .catch(() => undefined);

    await page.emulateMediaType("print");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      landscape: true,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm"
      }
    });

    return pdfBuffer;
  } finally {
    if (!page.isClosed()) {
      await page.close();
    }
  }
}
