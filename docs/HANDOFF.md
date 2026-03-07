# Handoff Técnico Completo

Última atualização: 2026-03-06

Este documento é a memória operacional para continuidade entre ambientes.

## 1) Contexto do produto

- Nome oficial: `Meta Ads Intelligence | VIASOFT`
- Stack:
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Recharts
- Puppeteer (`puppeteer-core` + `@sparticuz/chromium`)
- Sem banco de dados
- Sem autenticação (MVP)

Objetivo atual:

- leitura executiva de performance Meta Ads;
- comunicação clara para público não técnico;
- exportação de PDF fiel ao dashboard.

## 2) Estado funcional atual

## 2.1 Dashboard

- Carrega campanhas por `GET /api/meta/campaigns`.
- Exibe apenas campanhas com status e entrega ativos.
- Filtros:
- vertical
- campanha
- período (`7`, `14`, `28`, `30` dias)
- Ações:
- `Atualizar Dados` (refresh via `refresh=1`)
- `Gerar PDF`
- Blocos:
- cabeçalho de campanha
- estrutura (ad sets + ads)
- cards de métricas
- tendência consolidada
- gráfico diário
- insights e recomendações
- orçamento da vertical

## 2.2 Estrutura de campanha

- `GET /api/meta/adsets?campaignId=...`
- `GET /api/meta/ads?adSetId=...`
- `GET /api/meta/ad-preview?adId=...`

O painel mostra:

- ad sets ativos;
- ads ativos do ad set selecionado;
- criativo e destino;
- modal de preview avançado quando disponível.

## 2.3 Performance

- `GET /api/meta/performance?campaignId=...&rangeDays=...`
- Retorna `DashboardPayload` com comparação atual vs anterior, chart diário, insights e recomendações.

## 2.4 PDF

- Endpoint: `GET /api/pdf?campaignId=...&rangeDays=...`
- Geração backend em `lib/pdf-generator.ts`.
- Layout atual: 5 páginas (`PDF_TOTAL_PAGES = 5`).
- Compatível local/serverless.

## 3) Regras críticas implementadas

- Fonte de verdade: Meta API.
- Dia atual excluído dos períodos analíticos.
- Período baseado em timezone (`APP_TIMEZONE`).
- Ciclo de orçamento da vertical: 24 -> 23.
- Imposto no card de orçamento: 12,15%.
- Cache em memória com TTL 5 min e stale fallback 15 min.
- Validação de env em rotas `app/api/meta/*`.

## 4) Módulos centrais (atalho)

- Orquestração e cache: `lib/meta-dashboard.ts`
- Integração Meta API: `services/meta-api.ts`
- Tipos: `lib/types.ts`
- Cálculo de métricas: `utils/metrics.ts`
- Insights: `utils/insights-engine.ts`
- Tendência executiva: `utils/executive-signal.ts`
- Range principal: `utils/date-range.ts`
- Range de ciclo vertical: `utils/month-range.ts`
- PDF backend: `lib/pdf-generator.ts`
- Página PDF: `app/pdf/page.tsx`
- Cliente principal: `components/dashboard-client.tsx`

## 5) Comportamento de cache e refresh

- Leitura padrão usa cache fresco quando disponível.
- Em falha de API, pode retornar snapshot stale dentro de 15 min.
- Botão `Atualizar Dados` força refresh por query `refresh=1`.
- Invalidação explícita é manual via `POST /api/meta/cache/invalidate`.

## 6) Variáveis de ambiente críticas

Obrigatórias:

- `META_ACCESS_TOKEN`
- `META_AD_ACCOUNT_ID`

Relevantes:

- `META_API_VERSION`
- `APP_BASE_URL`
- `APP_TIMEZONE`
- `VERTICAL_MONTHLY_CAP_BRL`
- `META_WHATSAPP_NUMBER_BY_PAGE_ID_JSON`
- `INSIGHTS_*`
- `META_DESTINATION_DIAGNOSTIC_LOG`
- `CHROME_EXECUTABLE_PATH`

## 7) Pontos de atenção atuais

1. Alguns anúncios podem ficar sem URL final explícita por limitação de payload da Meta.
2. Layout PDF é sensível a alterações de altura de blocos e espaçamentos.
3. Cache em memória não é distribuído entre instâncias.

## 8) Fluxo recomendado de retomada

1. Ler:
- `docs/DOCUMENTACAO_COMPLETA.md`
- `docs/BUSINESS_RULES.md`
- `docs/SESSION_MEMORY.md`
- `docs/RUNBOOK.md`
2. Rodar:

```bash
npm install
npm run typecheck
npm run dev
```

3. Validar:
- campanhas
- performance
- estrutura de campanha
- PDF

## 9) Critérios para não quebrar continuidade

- Não remover `utils/insights-engine.ts`.
- Não incluir o dia atual em análise.
- Não alterar ciclo 24 -> 23 sem decisão explícita.
- Não remover imposto de 12,15% do card de orçamento.
- Não expor tokens/segredos em frontend.
- Preservar paridade de leitura entre dashboard e PDF.
