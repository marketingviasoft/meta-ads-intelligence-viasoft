# Meta Ads Intelligence | VIASOFT

Dashboard corporativo para leitura executiva e analítica de campanhas Meta Ads, com arquitetura Supabase-first, comparativos estruturais e exportação em PDF.

## Leitura obrigatória para continuidade

Antes de continuar desenvolvimento em outro ambiente, leia:

- `docs/DOCUMENTACAO_COMPLETA.md`
- `docs/HANDOFF.md`
- `docs/BUSINESS_RULES.md`
- `docs/RUNBOOK.md`
- `docs/PARITY_CONTRACT.json`

## Estado atual do produto

A aplicação deixou de ser um MVP local focado apenas em campanhas ativas. Hoje ela opera como uma camada de BI leve:

- sincroniza Meta -> Supabase;
- lê Supabase -> dashboard e PDF;
- usa a Meta Graph API apenas na sincronização e em endpoints pontuais de preview/enriquecimento;
- suporta campanhas fora do estado estritamente ativo;
- possui budget mensal por vertical com ciclo Meta e imposto;
- possui comparativos entre grupos de anúncios e anúncios;
- possui duas visões principais no dashboard:
  - `Resumo Executivo` em `/dashboard/executivo` (dashboard gerencial consolidado com leitura macro e filtros interativos nativos)
  - `Análise por Campanha` em `/dashboard/campanhas` (leitura operacional profunda com drill-down)

## Stack

- Next.js 16.1.6 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Recharts
- Node.js
- Supabase (camada principal de leitura analítica)
- Puppeteer Core + @sparticuz/chromium
- Meta Graph API (sincronização via cron + preview pontual)

## O que a aplicação entrega hoje

- visão executiva interativa para leitura macro consolidada, com distribuições, rankings e insights da carteira de campanhas;
- visão analítica por campanha com filtros de vertical, veiculação, campanha e período;
- budget mensal por vertical;
- comparativo automático com período anterior equivalente;
- comparativos entre grupos de anúncios e anúncios;
- KPIs de investimento, impressões, cliques, CTR, CPC e resultado principal por objetivo;
- tendência consolidada e performance diária;
- insights automáticos e recomendações por objetivo;
- cache em memória para consultas do dashboard;
- botão `Atualizar Dados` com invalidação manual de cache;
- PDF gerado em backend pela rota `/api/pdf`.

## Navegação atual do dashboard

A área principal do produto fica em `/dashboard` e possui duas visões irmãs:

### 1. Resumo Executivo
- rota: `/dashboard/executivo`
- leitura macro consolidada e painel gerencial interativo;
- usa controles visuais interativos na própria tela para os filtros globais que preservam estado via URL:
  - `verticalTag`
  - `deliveryGroup`
  - `rangeDays`

### 2. Análise por Campanha
- rota: `/dashboard/campanhas`
- leitura profunda de campanha, grupos de anúncios e anúncios
- pode receber `campaignId` pela URL para drill-down

### Parâmetros canônicos da URL
- `verticalTag` -> vertical selecionada
- `deliveryGroup` -> grupo de veiculação/status
- `rangeDays` -> janela de performance
- `campaignId` -> campanha selecionada na visão analítica

## Estrutura de pastas

```txt
/app
  /api
    /cron/sync-meta
    /meta
      /campaigns
      /performance
      /adsets
      /ads
      /ad-preview
      /compare
      /cache/invalidate
      /vertical-budget
    /pdf
  /dashboard
    /executivo
    /campanhas
  /pdf
/components
/lib
/services
/utils
/pdf
/docs
  /sql
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
META_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=act_1234567890
META_API_VERSION=v21.0
META_WHATSAPP_NUMBER_BY_PAGE_ID_JSON=
APP_BASE_URL=http://localhost:3000
APP_TIMEZONE=America/Sao_Paulo
INSIGHTS_MIN_IMPRESSIONS=1000
INSIGHTS_MIN_CLICKS=30
INSIGHTS_MIN_RESULTS=5
INSIGHTS_BASELINE_ACCOUNT_JSON=
INSIGHTS_BASELINE_BY_VERTICAL_JSON=
VERTICAL_MONTHLY_CAP_BRL=535
CRON_SECRET=
```

## Inicialização do Supabase

Antes da primeira execução, rode o script `docs/sql/meta_campaign_insights.sql` no painel SQL do Supabase para criar as tabelas necessárias.

## Instalação e execução local

1. Instale Node.js 20+.
2. Instale dependências:

```bash
npm install
```

3. Inicie em desenvolvimento:

```bash
npm run dev
```

4. Opcionalmente, dispare uma sincronização inicial:

```bash
curl -X GET "http://localhost:3000/api/cron/sync-meta" -H "Authorization: Bearer <CRON_SECRET>"
```

5. Abra a aplicação:

```txt
http://localhost:3000
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
```

## Rotas principais

* `GET /api/meta/campaigns`
* `GET /api/meta/performance?campaignId=...&rangeDays=7|14|28|30`
* `GET /api/meta/adsets?campaignId=...`
* `GET /api/meta/ads?adSetId=...`
* `GET /api/meta/ad-preview?adId=...`
* `GET /api/meta/compare?campaignId=...&entityType=ADSET|AD&entityIds=id1,id2&rangeDays=...`
* `GET /api/meta/vertical-budget?verticalTag=...`
* `POST /api/meta/cache/invalidate`
* `GET /api/pdf?campaignId=...&rangeDays=...`
* `GET /api/pdf?verticalTag=...&rangeDays=...`
* `GET /api/cron/sync-meta`

## Regras aplicadas no código

* fonte de verdade: Supabase (`meta_campaign_insights`, `meta_adsets`, `meta_ads`);
* performance do dashboard não inclui o dia atual;
* budget mensal da vertical inclui o dia atual como parcial;
* preview de anúncios continua Meta-direct;
* sem métricas inventadas;
* insights consumidos via `utils/insights-engine.ts` (analítico) e `utils/executive-insights.ts` (executivo), utilizando padronização de labels via `utils/labels.ts`;
* navegação executiva/analítica preserva filtros globais via query string.