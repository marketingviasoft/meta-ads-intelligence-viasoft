# Handoff Técnico Completo

Última atualização: 2026-03-13

Este documento é a memória operacional para continuidade entre ambientes.

## 1) Contexto do produto

- Nome oficial: `Meta Ads Intelligence | VIASOFT`
- Stack:
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Recharts
- Puppeteer (`puppeteer-core` + `@sparticuz/chromium`)
- Com banco de dados Supabase (tabelas: `meta_campaign_insights`, `meta_adsets`, `meta_ads`)
- Sincronização automática via Vercel Cron (`/api/cron/sync-meta`)
- Sem autenticação (MVP)

Objetivo atual:

- leitura executiva de performance Meta Ads;
- comunicação clara para público não técnico;
- exportação de PDF fiel ao dashboard.

## 2) Estado funcional atual

## 2.1 Dashboard

- Carrega campanhas por `GET /api/meta/campaigns`.
- Carrega orçamento mensal por vertical em `GET /api/meta/vertical-budget`.
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
- aviso de ausência de campanhas quando a vertical selecionada não possui campanha ativa.

## 2.2 Estrutura de campanha

- `GET /api/meta/adsets?campaignId=...`
- `GET /api/meta/ads?adSetId=...`
- `GET /api/meta/ad-preview?adId=...`
- `GET /api/meta/compare?campaignId=...&entityType=ADSET|AD&entityIds=id1,id2&rangeDays=...`

O painel mostra:

- ad sets ativos;
- ads ativos do ad set selecionado;
- criativo e destino;
- modal de preview avançado quando disponível.

## 2.3 Performance

- `GET /api/meta/performance?campaignId=...&rangeDays=...`
- Retorna `DashboardPayload` com comparação atual vs anterior, chart diário, insights e recomendações.

## 2.5 Comparação de estrutura

- `GET /api/meta/compare?campaignId=...&entityType=ADSET|AD&entityIds=id1,id2&rangeDays=...`
- Permite comparar 2 ad sets ou 2 ads da mesma campanha no mesmo período.
- Retorna `StructureComparisonPayload` com snapshots e deltas individuais.

## 2.6 Sincronização automática (Cron)

- `GET /api/cron/sync-meta` — orquestrador de ETL Meta → Supabase.
- Arquivo: `app/api/cron/sync-meta/route.js` (JavaScript).
- Agenda: diária às 03:00 UTC via `vercel.json`.
- Puxa insights assíncronos dos últimos 30 dias, enriquece com metadados de campanha/adset/ad, e faz upsert no Supabase.
- Lógica de "Adaptive Splitting": janela dividida recursivamente se a Meta API rejeitar por volume.
- Protegido por `CRON_SECRET` via header `x-cron-secret` ou `Authorization: Bearer`.

## 2.4 PDF

- Endpoints:
- `GET /api/pdf?campaignId=...&rangeDays=...` (relatório completo de campanha)
- `GET /api/pdf?verticalTag=...&rangeDays=...` (resumo de investimento da vertical)
- Geração backend em `lib/pdf-generator.ts`.
- Layout atual: 5 páginas (`PDF_TOTAL_PAGES = 5`).
- Compatível local/serverless.

## 3) Regras críticas implementadas

- Fonte de verdade: Supabase (`meta_campaign_insights`). Meta API atua para render em tempo real.
- Dia atual excluído dos períodos de performance.
- Orçamento mensal da vertical inclui dia atual (parcial).
- Período baseado em timezone (`APP_TIMEZONE`).
- Ciclo de orçamento da vertical: 24 -> 23.
- Imposto no card de orçamento: 12,15%.
- Cache em memória com TTL 5 min e stale fallback 15 min.
- Validação de env em rotas `app/api/meta/*`.

## 4) Módulos centrais (atalho)

- Orquestração principal e leitura Supabase (BFF): `lib/meta-insights-store.ts`
- Orquestração secundária e cache com Meta API direta (previews): `lib/meta-dashboard.ts`
- Sincronização Cron Meta → Supabase: `app/api/cron/sync-meta/route.js`
- Integração Meta API Direta: `services/meta-api.ts`
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

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
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

Segurança:

- `CRON_SECRET` (protege a rota de sincronização `/api/cron/sync-meta`)

## 6.1 Verticais suportadas

- `VIASOFT`
- `Agrotitan`
- `Construshow`
- `Filt`
- `Petroshow`
- `Voors`

Observação:

- a seleção de vertical é fixa e independente de existência de campanhas ativas;
- o card de orçamento da vertical continua funcionando mesmo sem campanha ativa.

## 7) Pontos de atenção atuais

1. Alguns anúncios podem ficar sem URL final explícita por limitação de payload da Meta.
2. Layout PDF é sensível a alterações de altura de blocos e espaçamentos.
3. Cache em memória não é distribuído entre instâncias.
4. A rota de sync (`/api/cron/sync-meta`) está em JavaScript puro (`.js`), não TypeScript.
5. Sem `CRON_SECRET` configurado, a rota de sync fica pública (o `isAuthorized` retorna `true`).
6. O sync cobre os últimos 30 dias. Dados anteriores exigem backfill manual.
7. O schema SQL (`docs/sql/meta_campaign_insights.sql`) deve ser rodado manualmente antes da primeira execução.

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
- Não incluir o dia atual nos cálculos de performance.
- Manter o card de orçamento da vertical com acúmulo até hoje (parcial no dia atual).
- Não alterar ciclo 24 -> 23 sem decisão explícita.
- Não remover imposto de 12,15% do card de orçamento.
- Não expor tokens/segredos em frontend.
- Preservar paridade de leitura entre dashboard e PDF.
- Não remover `CRON_SECRET` da validação sem substituir por outro mecanismo de autenticação.
- Não migrar `route.js` do cron para TS sem testar o build de produção (Vercel Functions).
