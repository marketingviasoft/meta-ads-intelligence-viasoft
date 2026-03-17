# Meta Ads Intelligence | VIASOFT

## Visao geral
Este projeto e um dashboard corporativo para leitura, analise e exportacao de relatorios de campanhas Meta Ads das verticais da VIASOFT. A aplicacao foi evoluida para uma arquitetura Supabase-first: o frontend e as rotas analiticas leem prioritariamente do Supabase, enquanto a Meta Graph API fica concentrada no processo de sincronizacao e em alguns endpoints pontuais de preview.

O produto atende tres objetivos principais:
- centralizar leitura executiva de campanhas em um dashboard unico;
- permitir analise operacional de campanha, grupos de anuncios e anuncios;
- gerar PDF institucional com layout de apresentacao.

## Stack atual
- Next.js 16.1.6 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Recharts
- Supabase (camada principal de leitura analitica)
- Puppeteer Core + @sparticuz/chromium (geracao de PDF na Vercel)
- Meta Graph API (sincronizacao via cron + preview pontual)

## Nome oficial e branding
- Nome oficial da aplicacao: `Meta Ads Intelligence | VIASOFT`
- Slug institucional: `meta-ads-intelligence-viasoft`
- Branding principal:
  - `public/logos/` para marca VIASOFT usada no produto/PDF;
  - `public/icons/verticais/` para icones das verticais nos seletores.

## Arquitetura atual
### 1. Camada de sincronizacao
A rota `app/api/cron/sync-meta/route.js` e a fonte de ingestao oficial.

Responsabilidades:
- disparar jobs assincronos da Meta Ads;
- fazer polling e retry/backoff;
- dividir o periodo automaticamente quando a Meta retornar excesso de dados;
- sincronizar performance no nivel mais granular (anuncio);
- fazer upsert em lote no Supabase.

Tabelas sincronizadas:
- `meta_campaign_insights`
- `meta_adsets`
- `meta_ads`

Versao atual da sincronizacao:
- `sync-meta-v3-fallback-safe`

### 2. Camada de leitura analitica
O arquivo central de leitura e agregacao local e `lib/meta-insights-store.ts`.

Ele concentra:
- leitura do Supabase;
- normalizacao de linhas;
- catalogo de campanhas;
- agrupamento de status/veiculacao;
- calculo do dashboard;
- calculo de comparativos;
- calculo do orcamento mensal da vertical;
- filtros por vertical, status e periodo.

### 3. Rotas analiticas Supabase-first
As rotas abaixo leem do Supabase e nao devem depender da Meta no carregamento normal da tela:
- `app/api/meta/campaigns/route.ts`
- `app/api/meta/performance/route.ts`
- `app/api/meta/vertical-budget/route.ts`
- `app/api/meta/adsets/route.ts`
- `app/api/meta/ads/route.ts`
- `app/api/meta/compare/route.ts`

### 4. Rotas ainda Meta-direct
Essas rotas continuam dependendo da Meta porque lidam com preview/enriquecimento de criativo:
- `app/api/meta/ad-preview/route.ts`
- `app/api/meta/ad-analytics/route.ts`

Consequencia pratica:
- o dashboard e os comparativos devem continuar funcionando mesmo se a Meta estiver instavel;
- o preview do anuncio pode falhar por permissao, rate limit ou restricao de conteudo.

## Seletor principal e fluxo de uso
Fluxo atual do usuario no dashboard:
1. Vertical
2. Veiculacao
3. Campanha
4. Periodo

### Vertical
- Opcao padrao: `Todas as verticais`
- Valor tecnico padrao: `__ALL_VERTICALS__`
- Verticais suportadas hoje:
  - VIASOFT
  - Agrotitan
  - Construshow
  - Filt
  - Petroshow
  - Voors
- Campanhas fora do padrao continuam aparecendo apenas dentro de `Todas as verticais`.

### Veiculacao
O filtro de status foi simplificado para refletir a leitura de veiculacao e nao uma lista extensa de status crus da Meta.

Grupos utilizados pela aplicacao:
- `ALL` -> Todos os status
- `ACTIVE` -> Ativas
- `PAUSED` -> Pausadas
- `WITH_ISSUES` -> Com problemas
- `PENDING_REVIEW` -> Em analise
- `ARCHIVED` -> Arquivadas

Observacao importante:
- a classificacao exibida para o usuario e derivada de regras de normalizacao locais;
- o badge de campanha no cabecalho usa `deliveryGroup`, nao o codigo cru da Meta.

### Campanhas
O catalogo atual nao e mais "somente ativas".

A lista pode incluir:
- campanhas em veiculacao;
- campanhas pausadas;
- campanhas encerradas;
- campanhas sem entrega recente;
- campanhas arquivadas;
- campanhas historicas dentro da janela de consulta do catalogo.

Janela de lookback do catalogo:
- `CAMPAIGN_STATUS_LOOKBACK_DAYS = 180`

### Periodo
- O periodo de performance do dashboard exclui o dia atual.
- O card de orcamento mensal da vertical inclui o dia atual como parcial.

## Regras de negocio principais
### 1. Orcamento mensal por vertical
A logica do budget mensal esta em `lib/meta-insights-store.ts`.

Constantes atuais:
- teto base padrao sem imposto: `R$ 535,00`
- imposto Meta: `12,15%`
- teto total padrao com imposto: `R$ 600,00`
- teto total da vertical VIASOFT com imposto: `R$ 1.000,00`

Regras:
- o ciclo de faturamento Meta considerado e fixo: dia 24 do mes anterior ate dia 23 do mes atual;
- o card mostra o acumulado do ciclo corrente;
- o total exibido ao usuario e `investimento + imposto`;
- a barra de progresso mostra valor investido e valor com imposto;
- se a vertical selecionada for `Todas as verticais`, o card de budget nao agrega tudo; ele pede para escolher uma vertical especifica.

### 2. Periodos de performance
- Performance do dashboard: nunca inclui o dia atual.
- Budget da vertical: inclui o dia atual como parcial.
- PDF segue a mesma regra do dashboard para performance.

### 3. KPI principal dinamico
A familia de metricas foi padronizada e se adapta ao objetivo da campanha.

Metricas base usadas na campanha e nos comparativos:
- valor investido (`spend`)
- visualizacoes do anuncio (`impressions`)
- cliques no anuncio (`clicks`)
- taxa de cliques (`ctr`)
- custo por clique (`cpc`)
- resultados da campanha (`results`)

KPI principal por objetivo:
- TRAFFIC -> clicks
- RECOGNITION -> impressions
- ENGAGEMENT -> results
- CONVERSIONS -> results

### 4. Estrutura da campanha
A secao `Estrutura da campanha` mostra:
- grupos de anuncios da campanha;
- anuncios do grupo selecionado;
- miniatura quando disponivel;
- nome do criativo quando disponivel;
- destino quando disponivel;
- comparacao opcional entre 2 grupos ou 2 anuncios.

### 5. Comparativos
Os comparativos nao usam seletor extra.

Fluxo atual:
- o usuario marca ate 2 grupos de anuncios na secao de estrutura;
- o usuario marca ate 2 anuncios na secao de estrutura;
- as secoes de comparativo aparecem apenas quando existem exatamente 2 selecoes validas.

Secoes existentes:
- `Comparativo entre grupos de anuncios`
- `Comparativo entre anuncios`

Premissas atuais:
- os comparativos usam a mesma familia de metricas da campanha;
- nao ha bloco A-B com diferenca textual;
- o foco e leitura direta de valores por item.

## Dashboard atual
A pagina principal esta organizada nesta ordem:
1. Header institucional
2. Seletores
3. Orcamento mensal da vertical
4. Informacoes da campanha
5. Estrutura da campanha
6. Comparativo entre grupos de anuncios (condicional)
7. Comparativo entre anuncios (condicional)
8. Cards de metricas
9. Tendencia consolidada
10. Performance diaria
11. Insights automaticos
12. Recomendacoes por objetivo

## PDF atual
A exportacao de PDF foi refatorada varias vezes e hoje esta em fluxo dinamico.

### Rota
- `app/api/pdf/route.ts`

### Gerador
- `lib/pdf-generator.ts`

### Renderizacao
- `app/pdf/page.tsx`

### Entradas aceitas
A rota de PDF aceita:
- `campaignId`
- `verticalTag`
- `deliveryGroup`
- `rangeDays`
- `selectedAdSetId`
- `compareAdSetIds`
- `compareAdIds`

### Regras atuais do PDF
- Se existir apenas `verticalTag` e nao existir `campaignId`, o sistema gera um PDF compacto de budget da vertical.
- No fluxo normal por campanha, a ordem atual e:
  1. Cabecalho + seletores + budget mensal
  2. Pagina de comparativos (somente se houver 2 grupos ou 2 anuncios selecionados)
  3. Cards de metricas
  4. Tendencia consolidada + Performance diaria
  5. Insights automaticos + Recomendacoes por objetivo

Observacao importante:
- a pagina de `Informacoes da campanha` e a pagina de `Estrutura da campanha` nao fazem parte do fluxo padrao atual do PDF.
- existe uma constante legada `PDF_TOTAL_PAGES = 5` em `pdf/layout-preset.ts`; ela nao representa sozinha toda a logica real de pagina, porque a pagina de comparativos e condicional.

## Tipos e contratos principais
Arquivo central:
- `lib/types.ts`

Tipos relevantes:
- `MetaCampaign`
- `MetaAdSet`
- `MetaAd`
- `DashboardPayload`
- `VerticalBudgetSummary`
- `StructureComparisonPayload`
- `NormalizedInsightRow`

Campos importantes em `MetaCampaign`:
- `verticalTag`
- `deliveryStatus`
- `effectiveStatus`
- `lifecycleStatus`
- `deliveryGroup`
- `hasActivityInRange`
- `periodSpend`
- `periodImpressions`
- `periodClicks`

## Banco de dados Supabase
Script principal:
- `docs/sql/meta_campaign_insights.sql`

Tabelas:
- `meta_campaign_insights`
- `meta_adsets`
- `meta_ads`

Granularidade real da tabela principal:
- diaria
- por campanha
- por grupo de anuncios
- por anuncio

Constraint de unicidade da tabela principal:
- `(date, campaign_id, adset_id, ad_id)`

## Preview de anuncio: limitacoes conhecidas
A visualizacao do preview nao e 100% garantida, porque depende da Meta.

Limitacoes esperadas:
- mensagem de permissao do perfil/asset;
- preview indisponivel para determinados anuncios ou criativos;
- nome do criativo e destino podem depender do nivel de enriquecimento salvo no Supabase;
- quando a Meta nao expuser a URL final, o dashboard pode usar fallback textual explicativo.

## Cron e operacao
### Agendamento
- Arquivo: `vercel.json`
- Cron atual configurado para Vercel Hobby: `0 3 * * *`
- Observacao: na Vercel, cron usa UTC.

### Seguranca
- A rota pode ser protegida por `CRON_SECRET`.

### Sincronizacao manual
Local:
- `curl.exe -X GET "http://localhost:3000/api/cron/sync-meta" -H "Authorization: Bearer <CRON_SECRET>"`

Vercel:
- `curl.exe -X GET "https://SEU-DOMINIO/api/cron/sync-meta" -H "Authorization: Bearer <CRON_SECRET>"`

## Riscos e dividas tecnicas atuais
1. `docs/PARITY_CONTRACT.json` e `pdf/layout-preset.ts` precisam continuar alinhados sempre que o PDF mudar.
2. Preview de anuncio ainda nao esta completamente desacoplado da Meta.
3. A logica de enriquecimento de criativo/destino depende da disponibilidade de campos da Meta e pode degradar para fallback.
4. O catalogo e o filtro de veiculacao exigem manutencao cuidadosa sempre que houver mudanca de regra comercial.
5. Qualquer alteracao no budget precisa considerar:
   - ciclo 24 -> 23;
   - imposto de 12,15%;
   - excecao de teto da VIASOFT.

## Arquivos mais importantes para continuar o desenvolvimento
- `components/dashboard-client.tsx`
- `components/dashboard-report.tsx`
- `components/campaign-structure-panel.tsx`
- `components/structure-comparison-section.tsx`
- `components/performance-chart.tsx`
- `app/api/meta/campaigns/route.ts`
- `app/api/meta/performance/route.ts`
- `app/api/meta/compare/route.ts`
- `app/api/meta/vertical-budget/route.ts`
- `app/api/cron/sync-meta/route.js`
- `lib/meta-insights-store.ts`
- `lib/types.ts`
- `lib/pdf-generator.ts`
- `app/pdf/page.tsx`
- `docs/sql/meta_campaign_insights.sql`

## Estado atual resumido
A aplicacao hoje ja nao e mais um dashboard que consulta a Meta em tempo real no carregamento principal. Ela opera como uma camada de BI leve:
- sincroniza Meta -> Supabase;
- le Supabase -> dashboard;
- usa Meta apenas para enriquecimentos pontuais;
- suporta campanhas fora do estado estritamente ativo;
- possui budget mensal por vertical com ciclo Meta e imposto;
- possui comparativos de grupos e anuncios;
- gera PDF institucional com paginas dinamicas.
