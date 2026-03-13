# Regras de Negócio Oficiais

Última atualização: 2026-03-13

Este documento consolida as regras que devem ser preservadas no produto conforme implementação atual.

## 1) Fonte de verdade

- A fonte principal de dados (campanhas, adsets, ads e performance) é o Supabase (`meta_campaign_insights`).
- Dados em tempo real como o preview do anúncio (iframe do Meta) vêm diretamente da Meta API.
- Não inventar métricas.
- Não substituir dados reais por estimativas sem justificativa clara.
- A sincronização dos dados da Meta para o Supabase é feita via job automático (`/api/cron/sync-meta`), agendado diariamente via Vercel Cron.

## 2) Elegibilidade de campanhas

- O seletor exibe somente campanhas com:
- `effective_status = ACTIVE`;
- `deliveryStatus = ACTIVE` (calculado a partir dos ad sets).
- Campanhas sem veiculação ativa não entram no fluxo principal do dashboard.

## 2.1) Verticais suportadas e seleção

- O seletor de vertical é fixo e deve conter exatamente:
- `VIASOFT`
- `Agrotitan`
- `Construshow`
- `Filt`
- `Petroshow`
- `Voors`
- A seleção da vertical não pode depender da existência de campanha ativa.

## 3) Períodos de análise

- Períodos permitidos: `7`, `14`, `28`, `30`.
- Nos períodos de performance, o dia atual nunca é incluído.
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
- considerar dados até hoje no fuso configurado (inclui parcial do dia atual);
- limitar a coleta ao fim do ciclo.
- No somatório de investimento mensal por vertical:
- considerar somente campanhas com veiculação no período (`impressions > 0`) e gasto positivo (`spend > 0`);
- essa regra independe de a campanha estar ativa hoje no Meta Ads.
- Em validações no Ads Manager, o período deve terminar em hoje para bater com o card da aplicação.

## 6) Teto + imposto no card de orçamento

- Teto base por vertical: `VERTICAL_MONTHLY_CAP_BRL` (default `535`).
- Teto total padrão por vertical (com imposto): `R$ 600,00`.
- Exceção de negócio:
- vertical `VIASOFT` possui teto total do ciclo em `R$ 1.000,00` (já com imposto).
- internamente o código calcula o cap pré-imposto: `1000 / (1 + 0.1215) = ~R$ 891,66` (`VIASOFT_VERTICAL_MONTHLY_CAP`).
- para as demais verticais, o cap padrão é `R$ 535,00` (pré-imposto), totalizando `~R$ 600,00` com imposto.
- Imposto sobre investimento: `12,15%`.
- O card deve mostrar:
- valor investido;
- valor do imposto;
- total (investimento + imposto);
- saldo ou excedente.
- O destaque principal de investimento deve exibir o total (investimento + imposto).
- A barra de progresso deve usar teto total (base + imposto).
- O card de orçamento da vertical deve continuar disponível mesmo sem campanhas ativas para a vertical selecionada.

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
- Parâmetros de PDF adicionais aceitos: `deliveryGroup`, `selectedAdSetId`, `compareAdSetIds`, `compareAdIds`.

## 10.1) PDF por vertical (sem campanha ativa)

- Quando não há campanha ativa na vertical selecionada, o PDF exibe apenas o resumo de orçamento mensal.
- Render em modo compacto (1 página).

## 11) Branding

- Nome oficial: `Meta Ads Intelligence | VIASOFT`.
- Branding institucional: `public/logos/*`.
- Ícones de verticais: `public/icons/verticais/*`.

## 12) Restrições operacionais

- Não expor token em frontend.
- Não versionar `.env.local`.
- Banco de dados Supabase operando com `meta_campaign_insights`, `meta_adsets` e `meta_ads`.
- Schema SQL deve ser executado manualmente antes da primeira operação (`docs/sql/meta_campaign_insights.sql`).
- `CRON_SECRET` deve ser configurado para proteger a rota de sincronização em ambiente público.
- Sem autenticação no MVP atual.

## 13) PDF sem campanha ativa

- A exportação de PDF deve funcionar mesmo quando a vertical selecionada não possui campanhas ativas.
- Nesse cenário, o PDF deve apresentar pelo menos o resumo de investimento mensal da vertical.
- A rota `/api/pdf` deve aceitar `verticalTag` como alternativa ao `campaignId`.
- Quando houver `campaignId`, o comportamento completo do PDF de campanha permanece inalterado.

## 14) Comparação de estrutura

- Endpoint: `GET /api/meta/compare?campaignId=...&entityType=ADSET|AD&entityIds=id1,id2&rangeDays=...`.
- Permite comparar exatamente 2 entidades (ad sets ou ads) da mesma campanha.
- Retorna snapshots de métricas (atual e anterior) e deltas por entidade.
- Validação: rejeita se `entityIds` não contiver exatamente 2 IDs.
- Lógica em `lib/meta-insights-store.ts` função `getStructureComparisonPayloadFromStore`.
