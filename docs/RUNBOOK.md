# Runbook Operacional

Última atualização: 2026-03-06

Este runbook descreve como subir, validar e operar o projeto localmente com base no comportamento atual do código.

## 1) Pré-requisitos

- Node.js 20+ (LTS recomendado)
- npm funcional no terminal
- Arquivo `.env.local` preenchido

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

Variáveis opcionais:

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

Comandos úteis:

```bash
npm run typecheck
npm run lint
npm run build
```

## 4) Endpoints internos

- `GET /api/meta/campaigns`
- `GET /api/meta/vertical-budget?verticalTag=...`
- `GET /api/meta/performance?campaignId=...&rangeDays=7|14|28|30`
- `GET /api/meta/adsets?campaignId=...`
- `GET /api/meta/ads?adSetId=...`
- `GET /api/meta/ad-preview?adId=...`
- `POST /api/meta/cache/invalidate`
- `GET /api/pdf?campaignId=...&rangeDays=...`

## 5) Fluxo de validação rápida (aceite)

1. Abrir a home.
2. Confirmar carregamento de campanhas ativas com veiculação.
3. Selecionar campanha e período.
4. Clicar em `Atualizar Dados`.
5. Validar:
- cards com valores e deltas;
- estrutura (ad sets / ads);
- preview avançado em pelo menos 2 anúncios;
- card de orçamento da vertical (investimento + imposto).
6. Selecionar uma vertical sem campanhas ativas e validar:
- card de orçamento continua visível e atualizado;
- aviso de ausência de campanhas ativas aparece abaixo dos filtros.
7. Gerar PDF e validar:
- paginação;
- gráfico e legenda;
- rodapé em todas as páginas;
- ausência de páginas em branco.

## 6) Refresh, cache e invalidação

Comportamento atual do botão `Atualizar Dados`:

- força nova leitura das rotas de campanhas, orçamento da vertical, performance, ad sets e ads usando `refresh=1`;
- não chama automaticamente `POST /api/meta/cache/invalidate`.

Endpoint de invalidação (uso manual):

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

## 7) PDF local e serverless

Regras de execução:

- rota de PDF usa runtime Node (`app/api/pdf/route.ts`);
- local: usa Chrome local (auto-detect) ou `CHROME_EXECUTABLE_PATH`;
- serverless (Vercel/AWS): usa `@sparticuz/chromium` + `puppeteer-core`.

Pré-condições práticas:

- `APP_BASE_URL` configurado corretamente para o ambiente;
- dependências instaladas sem remoção de `puppeteer-core` e `@sparticuz/chromium`.

## 8) Troubleshooting

### 8.1 `META_ACCESS_TOKEN não configurado` / `META_AD_ACCOUNT_ID não configurado`

- revisar `.env.local`;
- reiniciar o servidor após alterar env.

### 8.2 Sem campanhas no seletor

- confirmar campanhas com `effective_status = ACTIVE`;
- confirmar veiculação ativa (delivery calculado por ad sets);
- revisar permissões do token (`ads_read`).

### 8.3 Alerta de contingência (snapshot stale)

- significa falha na leitura mais recente da Meta API;
- o dashboard exibiu cache stale dentro da janela de contingência;
- tentar novo refresh e validar conectividade/permissões.

### 8.4 PDF falhando por browser local

- definir `CHROME_EXECUTABLE_PATH`;
- validar se o Chrome instalado está acessível pelo usuário atual.

### 8.5 Destino de anúncio sem URL identificada

- alguns criativos não expõem URL final no payload da Meta;
- revisar `services/meta-api.ts` (resolução de `destinationUrl`);
- para diagnóstico, habilitar `META_DESTINATION_DIAGNOSTIC_LOG=1`.

### 8.6 Divergência de investimento entre dashboard e Ads Manager

- o card de orçamento da vertical acumula até a data atual (dia atual parcial);
- valide no Ads Manager com a mesma janela (`since` do ciclo até hoje);
- o card exibe "Dados acumulados até DD/MM/AAAA" para facilitar a conferência.

## 9) Retomada rápida de ambiente

```bash
git pull
npm install
npm run typecheck
npm run dev
```

## 10) Continuidade de documentação

Antes de encerrar sessão de trabalho, atualizar:

- `docs/HANDOFF.md`
- `docs/SESSION_MEMORY.md`

Para visão técnica completa, usar também:

- `docs/DOCUMENTACAO_COMPLETA.md`

## 11) Exporta��o de PDF sem campanha ativa

- Fluxo suportado: quando n�o houver campanha ativa na vertical, usar `GET /api/pdf?verticalTag=...&rangeDays=...`.
- O PDF gerado nesse modo cont�m o bloco de investimento mensal da vertical e sinaliza��o de aus�ncia de campanhas ativas.
- Fluxo tradicional continua dispon�vel: `GET /api/pdf?campaignId=...&rangeDays=...`.
