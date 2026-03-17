import fs from "node:fs";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

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
      "Chrome não encontrado no ambiente local. Configure CHROME_EXECUTABLE_PATH para usar recursos headless localmente."
    );
  }

  return {
    headless: true,
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  };
}

export async function getSharedBrowser(): Promise<Awaited<ReturnType<typeof puppeteer.launch>>> {
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
