import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const contractPath = path.join(rootDir, "docs", "PARITY_CONTRACT.json");
const pdfSourcePath = path.join(rootDir, "app", "pdf", "page.tsx");
const dashboardSourcePaths = [
  path.join(rootDir, "components", "dashboard-client.tsx"),
  path.join(rootDir, "components", "dashboard-report.tsx"),
  path.join(rootDir, "components", "campaign-structure-panel.tsx"),
  path.join(rootDir, "components", "insights-panel.tsx")
];

function readUtf8File(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function extractMarkers(source, attributeName) {
  const regex = new RegExp(`${attributeName}="([^"]+)"`, "g");
  const markers = [];
  let match = regex.exec(source);

  while (match) {
    markers.push(match[1]);
    match = regex.exec(source);
  }

  return markers;
}

function fail(message) {
  console.error(`[parity-check] ERRO: ${message}`);
  process.exitCode = 1;
}

const contract = JSON.parse(readUtf8File(contractPath));

const dashboardSource = dashboardSourcePaths.map(readUtf8File).join("\n");
const dashboardMarkers = new Set(extractMarkers(dashboardSource, "data-dashboard-block"));

for (const block of contract.dashboardBlocks) {
  if (!dashboardMarkers.has(block)) {
    fail(`Bloco do dashboard ausente: "${block}"`);
  }
}

const pdfSource = readUtf8File(pdfSourcePath);
const pageRegex = /data-pdf-page="(\d+)"/g;
const pageMatches = [...pdfSource.matchAll(pageRegex)];

if (pageMatches.length === 0) {
  fail("Nenhuma página PDF marcada com data-pdf-page foi encontrada.");
}

const blocksByPage = new Map();

for (let index = 0; index < pageMatches.length; index += 1) {
  const currentMatch = pageMatches[index];
  const page = Number.parseInt(currentMatch[1], 10);
  const startIndex = currentMatch.index ?? 0;
  const endIndex = pageMatches[index + 1]?.index ?? pdfSource.length;
  const pageSlice = pdfSource.slice(startIndex, endIndex);
  const blocks = extractMarkers(pageSlice, "data-pdf-block");
  blocksByPage.set(page, new Set(blocks));
}

for (const pageRule of contract.pdfPages) {
  const pageBlocks = blocksByPage.get(pageRule.page);
  if (!pageBlocks) {
    fail(`Página ${pageRule.page} ausente no template PDF.`);
    continue;
  }

  for (const expectedBlock of pageRule.blocks) {
    if (!pageBlocks.has(expectedBlock)) {
      fail(`Bloco "${expectedBlock}" ausente na página PDF ${pageRule.page}.`);
    }
  }
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}

console.log("[parity-check] OK: blocos do Dashboard e do PDF estão presentes conforme contrato.");
