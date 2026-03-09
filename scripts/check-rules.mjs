import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

function readFile(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Arquivo obrigatório ausente: ${relativePath}`);
  }

  return fs.readFileSync(fullPath, "utf8");
}

function assertContains(source, expectedSnippet, errorMessage) {
  if (!source.includes(expectedSnippet)) {
    throw new Error(errorMessage);
  }
}

try {
  const dateRangeSource = readFile("utils/date-range.ts");
  assertContains(
    dateRangeSource,
    "const endDate = addDays(today, -1);",
    "Regra crítica quebrada: cálculo de performance deve excluir o dia atual."
  );

  const monthRangeSource = readFile("utils/month-range.ts");
  assertContains(
    monthRangeSource,
    "parts.day >= 24",
    "Regra crítica quebrada: início do ciclo de faturamento Meta (dia 24) não encontrado."
  );
  assertContains(
    monthRangeSource,
    "Date.UTC(parts.year, parts.month, 23)",
    "Regra crítica quebrada: término do ciclo de faturamento Meta (dia 23) não encontrado."
  );

  const metaDashboardSource = readFile("lib/meta-dashboard.ts");
  assertContains(
    metaDashboardSource,
    "until: monthRange.dataUntil",
    "Regra crítica quebrada: orçamento mensal da vertical deve incluir acumulado até o dia atual (parcial)."
  );

  const budgetPanelSource = readFile("components/dashboard-report.tsx");
  assertContains(
    budgetPanelSource,
    "const META_INVESTMENT_TAX_RATE = 0.1215;",
    "Regra crítica quebrada: imposto fixo de 12,15% não encontrado no card de orçamento."
  );
  assertContains(
    budgetPanelSource,
    "Ciclo de faturamento Meta:",
    "Regra crítica quebrada: texto do ciclo de faturamento Meta não está visível no card de orçamento."
  );

  const insightsEngineSource = readFile("utils/insights-engine.ts");
  assertContains(
    insightsEngineSource,
    "export function generateInsights",
    "Regra crítica quebrada: função generateInsights não encontrada."
  );
  assertContains(
    insightsEngineSource,
    "const CTR_BASELINE",
    "Regra crítica quebrada: baseline de CTR ausente no insights engine."
  );
  assertContains(
    insightsEngineSource,
    "const CPC_LIMIT",
    "Regra crítica quebrada: baseline de CPC ausente no insights engine."
  );

  const pdfPageSource = readFile("app/pdf/page.tsx");
  for (const pageMarker of ['data-pdf-page="1"', 'data-pdf-page="2"', 'data-pdf-page="3"', 'data-pdf-page="4"', 'data-pdf-page="5"']) {
    assertContains(
      pdfPageSource,
      pageMarker,
      `Regra crítica quebrada: marcador ${pageMarker} ausente no layout de PDF.`
    );
  }

  console.log("[rules-check] OK: regras críticas validadas.");
} catch (error) {
  const message = error instanceof Error ? error.message : "Falha desconhecida";
  console.error(`[rules-check] ERRO: ${message}`);
  process.exit(1);
}
