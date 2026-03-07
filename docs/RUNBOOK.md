# Runbook Operacional

## 1) Pré-requisitos

- Node.js 20+ (LTS recomendado)
- npm funcional no terminal
- Variáveis em `.env.local`

## 2) Configuração de ambiente

Base mínima:

```env
META_ACCESS_TOKEN=SEU_TOKEN
META_AD_ACCOUNT_ID=act_XXXXXXXXXXXX
META_API_VERSION=v21.0
APP_BASE_URL=http://localhost:3000
APP_TIMEZONE=America/Sao_Paulo
VERTICAL_MONTHLY_CAP_BRL=535
```

Opcional:

```env
META_WHATSAPP_NUMBER_BY_PAGE_ID_JSON=
INSIGHTS_MIN_IMPRESSIONS=1000
INSIGHTS_MIN_CLICKS=30
INSIGHTS_MIN_RESULTS=5
INSIGHTS_BASELINE_ACCOUNT_JSON=
INSIGHTS_BASELINE_BY_VERTICAL_JSON=
META_DESTINATION_DIAGNOSTIC_LOG=0
CHROME_EXECUTABLE_PATH=
```

## 3) Instalação e execução

```bash
npm install
npm run dev
```

Aplicação:
- `http://localhost:3000`

Checagem de tipo:

```bash
npm run typecheck
```

Build:

```bash
npm run build
```

## 4) Endpoints-chave

- `GET /api/meta/campaigns`
- `GET /api/meta/performance?campaignId=...&rangeDays=7|14|28|30`
- `GET /api/meta/adsets?campaignId=...`
- `GET /api/meta/ads?adSetId=...`
- `GET /api/meta/ad-preview?adId=...`
- `POST /api/meta/cache/invalidate`
- `GET /api/pdf?campaignId=...&rangeDays=...`

## 5) Fluxo de validação rápida (aceite)

1. Abrir home.
2. Confirmar carregamento de campanhas.
3. Selecionar campanha + período.
4. Clicar em `Atualizar Dados`.
5. Validar:
   - cards com valores e deltas
   - estrutura (adsets/ads)
   - preview avançado de 2 criativos diferentes
   - card de orçamento vertical (investimento + imposto)
6. Gerar PDF e validar:
   - paginação
   - legenda do gráfico
   - rodapé na mesma página
   - sem páginas em branco extras

## 6) Invalidação de cache

Exemplos payload:

```json
{ "scope": "all" }
```

```json
{ "scope": "campaigns" }
```

```json
{
  "scope": "performance",
  "campaignId": "123",
  "rangeDays": 7
}
```

## 7) Deploy na Vercel (PDF)

Pontos obrigatórios:

- Runtime Node no endpoint de PDF.
- `puppeteer-core` + `@sparticuz/chromium`.
- `APP_BASE_URL` configurado.

Comportamento:
- local: usa Chrome local (`CHROME_EXECUTABLE_PATH` ou auto-detect)
- serverless: usa Chromium do `@sparticuz/chromium`.

## 8) Troubleshooting

### 8.1 `META_ACCESS_TOKEN não configurado` / `META_AD_ACCOUNT_ID não configurado`
- Verificar `.env.local`.
- Reiniciar servidor após mudar env.

### 8.2 Sem campanhas no seletor
- Verificar se há campanhas `ACTIVE` com `delivery ACTIVE`.
- Conferir permissões do token (ads_read).

### 8.3 PDF falhando por Chrome
- local: definir `CHROME_EXECUTABLE_PATH`.
- Vercel: confirmar `puppeteer-core` + `@sparticuz/chromium` em produção.

### 8.4 Destino de anúncio sem URL identificada
- Alguns criativos não retornam link utilizável no payload.
- Verificar `services/meta-api.ts` (resolução de `destinationUrl`).
- Para diagnóstico estruturado sem token, habilitar `META_DESTINATION_DIAGNOSTIC_LOG=1` e checar logs com prefixo `[meta-api][destination-diagnostic]`.

### 8.5 Gráfico achatado / quebra de página no PDF
- Ajustar somente:
  - `components/performance-chart.tsx` (altura/margens do chart)
  - `app/pdf/page.tsx` (padding/gaps da página 4)
- Evitar mexer em múltiplas páginas ao mesmo tempo.

## 9) Comandos úteis para retomar

```bash
git pull
npm install
npm run typecheck
npm run dev
```

## 10) Regra de handoff

Antes de encerrar uma sessão, atualizar:
- `docs/HANDOFF.md`
- `docs/SESSION_MEMORY.md`

Assim o próximo ambiente começa sem perda de contexto.
