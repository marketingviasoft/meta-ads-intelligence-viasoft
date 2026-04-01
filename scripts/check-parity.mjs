import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const contractPath = path.join(rootDir, "docs", "PARITY_CONTRACT.json");
const pdfSourcePath = path.join(rootDir, "app", "pdf", "page.tsx");
const dashboardSourcePaths = [
  path.join(rootDir, "components", "dashboard-client.tsx"),
  path.join(rootDir, "components", "dashboard-report.tsx"),
  path.join(rootDir, "components", "structure-comparison-section.tsx"),
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
const pdfPages = contract.pdf?.pages ?? [];

const dashboardSource = dashboardSourcePaths.map(readUtf8File).join("\n");
const dashboardMarkers = new Set(extractMarkers(dashboardSource, "data-dashboard-block"));

for (const block of contract.dashboardBlocks) {
  if (!dashboardMarkers.has(block) && !dashboardSource.includes(block)) {
    fail(`Bloco do dashboard ausente: "${block}"`);
  }
}

const pdfSource = readUtf8File(pdfSourcePath);
const pdfBlocks = new Set(extractMarkers(pdfSource, "data-pdf-block"));

if (pdfBlocks.size === 0) {
  fail("Nenhum bloco PDF marcado com data-pdf-block foi encontrado.");
}

for (const pageRule of pdfPages) {
  for (const expectedBlock of pageRule.blocks) {
    if (!pdfBlocks.has(expectedBlock) && !pdfSource.includes(expectedBlock)) {
      fail(`Bloco "${expectedBlock}" ausente no template PDF.`);
    }
  }
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}

console.log("[parity-check] OK: blocos do Dashboard e do PDF estão presentes conforme contrato.");
