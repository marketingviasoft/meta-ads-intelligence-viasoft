import fs from "node:fs";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import type { RangeDays } from "@/lib/types";
import { PDF_VIEWPORT } from "@/pdf/layout-preset";
import { isValidRangeDays } from "@/utils/date-range";

let sharedBrowserPromise: Promise<Awaited<ReturnType<typeof puppeteer.launch>>> | null = null;

function resolveLocalChromePath(): string | null {
  const envExecutablePath =
    process.env.CHROME_EXECUTABLE_PATH ??
    process.env.PUPPETEER_EXECUTABLE_PATH ??
    null;

  if (envExecutablePath) {
    return envExecutablePath;
  }

  const platform = process.platform;

  const localCandidates =
    platform === "win32"
      ? [
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
          `${process.env.LOCALAPPDATA ?? ""}\\Google\\Chrome\\Application\\chrome.exe`
        ]
      : platform === "darwin"
        ? [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium"
          ]
        : ["/usr/bin/google-chrome-stable", "/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium"];

  for (const candidate of localCandidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function buildBrowserLaunchOptions(): Promise<Parameters<typeof puppeteer.launch>[0]> {
  const isServerlessRuntime =
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV !== undefined ||
    process.env.AWS_REGION !== undefined ||
    process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;

  if (isServerlessRuntime) {
    const executablePath = await chromium.executablePath();

    if (!executablePath) {
      throw new Error("Não foi possível resolver o executável do Chromium no ambiente serverless.");
    }

    return {
      headless: true,
      executablePath,
      args: [...chromium.args, "--hide-scrollbars", "--font-render-hinting=none"],
      defaultViewport: chromium.defaultViewport
    };
  }

  const executablePath = resolveLocalChromePath();

  if (!executablePath) {
    throw new Error(
      "Chrome não encontrado no ambiente local. Configure CHROME_EXECUTABLE_PATH para gerar PDF localmente."
    );
  }

  return {
    headless: true,
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  };
}

async function getSharedBrowser(): Promise<Awaited<ReturnType<typeof puppeteer.launch>>> {
  if (!sharedBrowserPromise) {
    sharedBrowserPromise = (async () => {
      const launchOptions = await buildBrowserLaunchOptions();
      const browser = await puppeteer.launch(launchOptions);

      browser.on("disconnected", () => {
        sharedBrowserPromise = null;
      });

      return browser;
    })();
  }

  return sharedBrowserPromise;
}

export async function generateDashboardPdf(params: {
  baseUrl: string;
  campaignId?: string;
  verticalTag?: string;
  rangeDays: RangeDays;
}): Promise<Uint8Array> {
  const { baseUrl, campaignId, verticalTag, rangeDays } = params;

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
