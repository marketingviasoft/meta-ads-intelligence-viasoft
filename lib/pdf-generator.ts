import puppeteer from "puppeteer";
import type { RangeDays } from "@/lib/types";
import { isValidRangeDays } from "@/utils/date-range";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function generateDashboardPdf(params: {
  baseUrl: string;
  campaignId: string;
  rangeDays: RangeDays;
}): Promise<Uint8Array> {
  const { baseUrl, campaignId, rangeDays } = params;

  if (!isValidRangeDays(rangeDays)) {
    throw new Error("Período inválido para PDF");
  }

  const printUrl = `${baseUrl}/pdf?campaignId=${encodeURIComponent(campaignId)}&rangeDays=${rangeDays}`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: 1754,
      height: 1240,
      deviceScaleFactor: 1
    });

    await page.goto(printUrl, {
      waitUntil: "networkidle0",
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

    try {
      await page.waitForSelector("body[data-pdf-ready='true']", {
        timeout: 12000
      });
    } catch {
      await sleep(1600);
    }

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
    await browser.close();
  }
}
