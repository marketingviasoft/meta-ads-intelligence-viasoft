# Meta Ads Intelligence | VIASOFT (MVP Local)

Publicação executiva para campanhas Meta Ads com comparativo de período e exportação em PDF via Puppeteer.

## Leitura obrigatória para continuidade

Antes de continuar desenvolvimento em outro ambiente, leia:

- `docs/HANDOFF.md`
- `docs/BUSINESS_RULES.md`
- `docs/SESSION_MEMORY.md`
- `docs/RUNBOOK.md`

## Stack

- Next.js (App Router)
- TypeScript
- TailwindCSS
- Recharts
- Node.js
- Puppeteer
- Supabase (Banco de dados de métricas)
- Sem autenticação (MVP local)

## O que o MVP entrega

- Lista campanhas com delivery `ACTIVE`
- Seleção de campanha
- Períodos: 7, 14, 28 e 30 dias
- Dia atual sempre excluído
- Comparativo automático com período anterior equivalente
- KPIs: investimento, impressões, cliques, CTR, CPC e resultado principal por objetivo
- Tendência consolidada
- Insights automáticos (CTR, CPC, custo por resultado, queda vs anterior)
- Recomendações por objetivo (traffic, engagement, recognition, conversions)
- Cache em memória por campanha + período (TTL 5 min)
- Botão `Atualizar Dados` com invalidação manual de cache
- PDF gerado em backend via Puppeteer pela rota `/pdf` (paisagem, sem html2canvas/jsPDF)

## Estrutura de pastas

```txt
/app
  /api
    /meta
      /campaigns
      /performance
      /cache/invalidate
    /pdf
  /pdf
/components
/lib
/services
/utils
/pdf
/api
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
# Opcional: fallback de numero WhatsApp por page_id (JSON)
META_WHATSAPP_NUMBER_BY_PAGE_ID_JSON=
APP_BASE_URL=http://localhost:3000
APP_TIMEZONE=America/Sao_Paulo
# Guardas minimos para evitar alertas com baixa amostra
INSIGHTS_MIN_IMPRESSIONS=1000
INSIGHTS_MIN_CLICKS=30
INSIGHTS_MIN_RESULTS=5
# Baseline da conta por objetivo (JSON)
INSIGHTS_BASELINE_ACCOUNT_JSON=
# Baseline por vertical e objetivo (JSON)
INSIGHTS_BASELINE_BY_VERTICAL_JSON=
# Teto mensal por vertical (BRL)
VERTICAL_MONTHLY_CAP_BRL=535
```

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

4. Abra:

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

## Objetivo -> métrica principal

- TRAFFIC -> `link_clicks`
- ENGAGEMENT -> `post_engagement`
- RECOGNITION -> `impressions`
- CONVERSIONS -> `conversions`

## PDF

Fluxo:

1. Clique em `Gerar PDF`
2. Backend abre `GET /api/pdf`
3. Puppeteer renderiza a rota interna `/pdf?campaignId=...&rangeDays=...`
4. Gera A4 paisagem com `printBackground`
5. Retorna download automático

## API routes

- `GET /api/meta/campaigns`
- `GET /api/meta/performance?campaignId=...&rangeDays=7|14|28|30`
- `POST /api/meta/cache/invalidate`
- `GET /api/pdf?campaignId=...&rangeDays=...`

## Regras aplicadas no código

- Fonte de verdade: Dados consolidados no Supabase (`meta_campaign_insights`, `meta_adsets`, `meta_ads`)
- Preview de Ads consulta a Meta API diretamente.
- Nenhum filtro inclui o dia atual
- Sem métricas inventadas
- Lógica separada em módulos (`services`, `utils`, `lib`)
- Engine de insights isolada em `utils/insights-engine.ts`
