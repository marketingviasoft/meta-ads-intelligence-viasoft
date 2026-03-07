# Regras de Negócio Oficiais

Última atualização: 2026-03-06

Este documento consolida as regras que devem ser preservadas no produto conforme implementação atual.

## 1) Fonte de verdade

- A fonte de dados é a Meta API.
- Não inventar métricas.
- Não substituir dados reais por estimativas sem justificativa clara.

## 2) Elegibilidade de campanhas

- O seletor exibe somente campanhas com:
- `effective_status = ACTIVE`;
- `deliveryStatus = ACTIVE` (calculado a partir dos ad sets).
- Campanhas sem veiculação ativa não entram no fluxo principal do dashboard.

## 3) Períodos de análise

- Períodos permitidos: `7`, `14`, `28`, `30`.
- O dia atual nunca é incluído.
- Sempre existe comparação com período anterior equivalente.
- Faixa temporal usa `APP_TIMEZONE` (default: `America/Sao_Paulo`).

## 4) Objetivo e resultado principal

Mapeamento aplicado no cálculo (`utils/metrics.ts`):

- `TRAFFIC`: `link_click`
- `ENGAGEMENT`: `post_engagement`
- `RECOGNITION`: `impressions`
- `CONVERSIONS`: `conversions` com fallback por `actions` de conversão

## 5) Ciclo de orçamento por vertical

- Ciclo fixo Meta: dia `24` até dia `23`.
- O card de orçamento deve exibir esse ciclo explicitamente.
- Para gasto do ciclo corrente:
- considerar dados até ontem;
- limitar a coleta ao fim do ciclo.

## 6) Teto + imposto no card de orçamento

- Teto base por vertical: `VERTICAL_MONTHLY_CAP_BRL` (default `535`).
- Imposto sobre investimento: `12,15%`.
- O card deve mostrar:
- valor investido;
- valor do imposto;
- total (investimento + imposto);
- saldo ou excedente.
- A barra de progresso deve usar teto total (base + imposto).

## 7) Insights e recomendações

- Engine central: `utils/insights-engine.ts`.
- Regras mínimas:
- detectar CTR abaixo da referência;
- detectar CPC acima da referência;
- detectar queda relevante de resultado;
- detectar alta relevante de custo por resultado.
- Guardas de amostra mínima:
- `INSIGHTS_MIN_IMPRESSIONS`
- `INSIGHTS_MIN_CLICKS`
- `INSIGHTS_MIN_RESULTS`

## 8) Tendência e semáforo executivo

- Tendência consolidada vem de `utils/metrics.ts`.
- Semáforo executivo (`MANTER`, `REVISAR`, `INTERVIR`) vem de `utils/executive-signal.ts`.
- Se a amostra mínima não for atingida, a ação não pode ser conclusiva.

## 9) Cache e atualização

- TTL principal: `5 minutos`.
- Stale fallback: `15 minutos`.
- `Atualizar Dados` força nova leitura via `refresh=1`.
- Invalidação explícita existe via `POST /api/meta/cache/invalidate`.

## 10) PDF

- Geração em backend com Puppeteer (`lib/pdf-generator.ts`).
- Rota dedicada: `/api/pdf` + render de `/pdf`.
- Deve preservar leitura executiva do dashboard.
- Deve evitar cortes indevidos e quebras incorretas de página.

## 11) Branding

- Nome oficial: `Meta Ads Intelligence | VIASOFT`.
- Branding institucional: `public/logos/*`.
- Ícones de verticais: `public/icons/verticais/*`.

## 12) Restrições operacionais

- Não expor token em frontend.
- Não versionar `.env.local`.
- Sem banco de dados no MVP atual.
- Sem autenticação no MVP atual.
