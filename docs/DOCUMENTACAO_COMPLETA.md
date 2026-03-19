# Meta Ads Intelligence | VIASOFT

## Visão geral
Este projeto é um dashboard corporativo para leitura, análise e exportação de relatórios de campanhas Meta Ads das verticais da VIASOFT. A aplicação foi evoluída para uma arquitetura Supabase-first: o frontend e as rotas analíticas leem prioritariamente do Supabase, enquanto a Meta Graph API fica concentrada no processo de sincronização e em alguns endpoints pontuais de preview.

O produto atende três objetivos principais:
- centralizar leitura executiva de campanhas em um dashboard único;
- permitir análise operacional de campanha, grupos de anúncios e anúncios;
- gerar PDF institucional com layout de apresentação.

## Stack atual
- Next.js 16.1.6 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Recharts
- Supabase (camada principal de leitura analítica)
- Puppeteer Core + @sparticuz/chromium (geração de PDF na Vercel)
- Meta Graph API (sincronização via cron + preview pontual)

## Nome oficial e branding
- Nome oficial da aplicação: `Meta Ads Intelligence | VIASOFT`
- Slug institucional: `meta-ads-intelligence-viasoft`
- Branding principal:
  - `public/logos/` para marca VIASOFT usada no produto/PDF;
  - `public/icons/verticais/` para ícones das verticais nos seletores.

## Arquitetura atual

### 1. Camada de sincronização
A rota `app/api/cron/sync-meta/route.js` é a fonte de ingestão oficial.

Responsabilidades:
- disparar jobs assíncronos da Meta Ads;
- fazer polling e retry/backoff;
- dividir o período automaticamente quando a Meta retornar excesso de dados;
- sincronizar performance no nível mais granular (anúncio);
- fazer upsert em lote no Supabase.

Tabelas sincronizadas:
- `meta_campaign_insights`
- `meta_adsets`
- `meta_ads`

Versão atual da sincronização:
- `sync-meta-v3-fallback-safe`

### 2. Camada de leitura analítica
O arquivo central de leitura e agregação local é `lib/meta-insights-store.ts`.

Ele concentra:
- leitura do Supabase;
- normalização de linhas;
- catálogo de campanhas;
- agrupamento de status/veiculação;
- cálculo do dashboard;
- cálculo de comparativos;
- cálculo do orçamento mensal da vertical;
- filtros por vertical, status e período.

### 3. Rotas analíticas Supabase-first
As rotas abaixo leem do Supabase e não devem depender da Meta no carregamento normal da tela:
- `app/api/meta/campaigns/route.ts`
- `app/api/meta/performance/route.ts`
- `app/api/meta/vertical-budget/route.ts`
- `app/api/meta/adsets/route.ts`
- `app/api/meta/ads/route.ts`
- `app/api/meta/compare/route.ts`

### 4. Rotas ainda Meta-direct
Estas rotas continuam dependendo da Meta porque lidam com preview/enriquecimento de criativo:
- `app/api/meta/ad-preview/route.ts`
- `app/api/meta/ad-analytics/route.ts`

Consequência prática:
- o dashboard e os comparativos devem continuar funcionando mesmo se a Meta estiver instável;
- o preview do anúncio pode falhar por permissão, rate limit ou restrição de conteúdo.

## Navegação atual do dashboard

A área principal da aplicação foi organizada em duas visões irmãs, com navegação visual por abas no topo e preservação dos filtros globais via query string.

### 1. Resumo Executivo
- rota: `/dashboard/executivo`
- foco: leitura macro/gerencial
- objetivo: consolidar KPIs, rankings, distribuições e visão geral da carteira de campanhas
- não depende de `campaignId` para funcionar

### 2. Análise por Campanha
- rota: `/dashboard/campanhas`
- foco: leitura operacional profunda
- objetivo: permitir análise detalhada de campanha, grupos de anúncios, anúncios, comparativos, insights e exportação em PDF
- pode receber `campaignId` pela URL para drill-down vindo da visão executiva

### Fluxo entre as visões
Fluxo esperado do produto:
1. usuário observa o panorama geral no `Resumo Executivo`;
2. identifica uma campanha relevante;
3. navega para `Análise por Campanha` com `campaignId` e filtros globais preservados;
4. aprofunda a leitura em grupos de anúncios, anúncios e comparativos.

### Parâmetros canônicos da URL
Os nomes canônicos usados para a navegação entre visões são:
- `verticalTag` -> vertical selecionada
- `deliveryGroup` -> grupo de veiculação/status
- `rangeDays` -> período de análise
- `campaignId` -> campanha selecionada na visão analítica

### Regras de URL e estado
- a URL é usada como estado inicial das telas;
- os filtros globais são preservados ao trocar entre visões;
- a visão executiva trabalha com:
  - `verticalTag`
  - `deliveryGroup`
  - `rangeDays`
- a visão analítica trabalha com:
  - `verticalTag`
  - `deliveryGroup`
  - `rangeDays`
  - `campaignId`
  - mais estados internos não roteáveis, como seleção de grupo, seleção de anúncio e comparações.

## Seletor principal e fluxo de uso

Fluxo atual do usuário na visão analítica:
1. Vertical
2. Veiculação
3. Campanha
4. Período

### Vertical
- Opção padrão: `Todas as verticais`
- Valor técnico padrão: `__ALL_VERTICALS__`
- Verticais suportadas hoje:
  - VIASOFT
  - Agrotitan
  - Construshow
  - Filt
  - Petroshow
  - Voors
- Campanhas fora do padrão continuam aparecendo apenas dentro de `Todas as verticais`.

### Veiculação
O filtro de status foi simplificado para refletir a leitura de veiculação e não uma lista extensa de status crus da Meta.

Grupos utilizados pela aplicação:
- `ALL` -> Todos os status
- `ACTIVE` -> Ativas
- `PAUSED` -> Pausadas
- `WITH_ISSUES` -> Com problemas
- `PENDING_REVIEW` -> Em análise
- `ARCHIVED` -> Arquivadas

Observação importante:
- a classificação exibida para o usuário é derivada de regras de normalização locais;
- o badge de campanha no cabeçalho usa `deliveryGroup`, não o código cru da Meta.

### Campanhas
O catálogo atual não é mais "somente ativas".

A lista pode incluir:
- campanhas em veiculação;
- campanhas pausadas;
- campanhas encerradas;
- campanhas sem entrega recente;
- campanhas arquivadas;
- campanhas históricas dentro da janela de consulta do catálogo.

Janela de lookback do catálogo:
- `CAMPAIGN_STATUS_LOOKBACK_DAYS = 180`

### Período
- O período de performance do dashboard exclui o dia atual.
- O card de orçamento mensal da vertical inclui o dia atual como parcial.

## Regras de negócio principais

### 1. Orçamento mensal por vertical
A lógica do budget mensal está em `lib/meta-insights-store.ts`.

Constantes atuais:
- teto base padrão sem imposto: `R$ 535,00`
- imposto Meta: `12,15%`
- teto total padrão com imposto: `R$ 600,00`
- teto total da vertical VIASOFT com imposto: `R$ 1.000,00`

Regras:
- o ciclo de faturamento Meta considerado é fixo: dia 24 do mês anterior até dia 23 do mês atual;
- o card mostra o acumulado do ciclo corrente;
- o total exibido ao usuário é `investimento + imposto`;
- a barra de progresso mostra valor investido e valor com imposto;
- se a vertical selecionada for `Todas as verticais`, o card de budget não agrega tudo; ele pede para escolher uma vertical específica.

### 2. Períodos de performance
- Performance do dashboard: nunca inclui o dia atual.
- Budget da vertical: inclui o dia atual como parcial.
- PDF segue a mesma regra do dashboard para performance.

### 3. KPI principal dinâmico
A família de métricas foi padronizada e se adapta ao objetivo da campanha.

Métricas base usadas na campanha e nos comparativos:
- valor investido (`spend`)
- visualizações do anúncio (`impressions`)
- cliques no anúncio (`clicks`)
- taxa de cliques (`ctr`)
- custo por clique (`cpc`)
- resultados da campanha (`results`)

KPI principal por objetivo:
- TRAFFIC -> clicks
- RECOGNITION -> impressions
- ENGAGEMENT -> results
- CONVERSIONS -> results

### 4. Estrutura da campanha
A seção `Estrutura da campanha` mostra:
- grupos de anúncios da campanha;
- anúncios do grupo selecionado;
- miniatura quando disponível;
- nome do criativo quando disponível;
- comparativo opcional entre 2 grupos ou 2 anúncios.

Observação importante:
- preview, metadados visuais e alguns enriquecimentos continuam sujeitos à disponibilidade real da Meta;
- o dashboard não deve prometer equivalência total com a interface do Ads Manager em criativo, thumbnail ou enriquecimento editorial.

### 5. Comparativos
Os comparativos não usam seletor extra.

Fluxo atual:
- o usuário marca até 2 grupos de anúncios na seção de estrutura;
- o usuário marca até 2 anúncios na seção de estrutura;
- as seções de comparativo aparecem apenas quando existem exatamente 2 seleções válidas.

Seções existentes:
- `Comparativo entre grupos de anúncios`
- `Comparativo entre anúncios`

Premissas atuais:
- os comparativos usam a mesma família de métricas da campanha;
- não há bloco A-B com diferença textual;
- o foco é leitura direta de valores por item.

## Dashboard atual

### Visão analítica
A página analítica está organizada nesta ordem:
1. Header institucional
2. Seletores
3. Orçamento mensal da vertical
4. Informações da campanha
5. Estrutura da campanha
6. Comparativo entre grupos de anúncios (condicional)
7. Comparativo entre anúncios (condicional)
8. Cards de métricas
9. Tendência consolidada
10. Performance diária
11. Insights automáticos
12. Recomendações por objetivo

### Visão executiva
A visão executiva foi criada para comportar leitura macro, desacoplada da campanha específica.

Responsabilidade dessa visão:
- consolidar KPIs executivos;
- mostrar evolução temporal consolidada;
- priorizar rankings e distribuições;
- permitir navegação para a análise detalhada por `campaignId`;
- crescer sem inflar o `DashboardClient`.

## PDF atual
A exportação de PDF foi refatorada várias vezes e hoje está em fluxo dinâmico.

### Rota
- `app/api/pdf/route.ts`

### Gerador
- `lib/pdf-generator.ts`

### Renderização
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
- Se existir apenas `verticalTag` e não existir `campaignId`, o sistema gera um PDF compacto de budget da vertical.
- No fluxo normal por campanha, a ordem atual é:
  1. Cabeçalho + seletores + budget mensal
  2. Página de comparativos (somente se houver 2 grupos ou 2 anúncios selecionados)
  3. Cards de métricas
  4. Tendência consolidada + Performance diária
  5. Insights automáticos + Recomendações por objetivo

Observação importante:
- a página de `Informações da campanha` e a página de `Estrutura da campanha` não fazem parte do fluxo padrão atual do PDF.
- a paginação do PDF é calculada pelo próprio fluxo de renderização em `app/pdf/page.tsx`, inclusive quando a página de comparativos é condicional.

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
- diária
- por campanha
- por grupo de anúncios
- por anúncio

Constraint de unicidade da tabela principal:
- `(date, campaign_id, adset_id, ad_id)`

## Preview de anúncio: limitações conhecidas
A visualização do preview não é 100% garantida, porque depende da Meta.

Limitações esperadas:
- mensagem de permissão do perfil/asset;
- preview indisponível para determinados anúncios ou criativos;
- nome do criativo pode depender do nível de enriquecimento salvo no Supabase;
- a interface do Ads Manager pode apresentar resolução visual mais rica do que a Graph API expõe de forma consistente.

## Cron e operação

### Agendamento
- Arquivo: `vercel.json`
- Cron atual configurado para Vercel Hobby: `0 3 * * *`
- Observação: na Vercel, cron usa UTC.

### Segurança
- A rota pode ser protegida por `CRON_SECRET`.

### Sincronização manual
Local:
- `curl.exe -X GET "http://localhost:3000/api/cron/sync-meta" -H "Authorization: Bearer <CRON_SECRET>"`

Vercel:
- `curl.exe -X GET "https://SEU-DOMINIO/api/cron/sync-meta" -H "Authorization: Bearer <CRON_SECRET>"`

## Riscos e dívidas técnicas atuais
1. `docs/PARITY_CONTRACT.json` e `pdf/layout-preset.ts` precisam continuar alinhados sempre que o PDF mudar.
2. Preview de anúncio ainda não está completamente desacoplado da Meta.
3. A lógica de enriquecimento de criativo depende da disponibilidade de campos da Meta e pode degradar para fallback.
4. O catálogo e o filtro de veiculação exigem manutenção cuidadosa sempre que houver mudança de regra comercial.
5. Qualquer alteração no budget precisa considerar:
   - ciclo 24 -> 23;
   - imposto de 12,15%;
   - exceção de teto da VIASOFT.
6. Qualquer alteração na navegação entre visões deve preservar o contrato de query string entre executivo e analítico.

## Arquivos mais importantes para continuar o desenvolvimento
- `components/dashboard-client.tsx`
- `components/dashboard-report.tsx`
- `components/campaign-structure-panel.tsx`
- `components/structure-comparison-section.tsx`
- `components/performance-chart.tsx`
- `components/dashboard-view-tabs.tsx`
- `components/executive-dashboard-client.tsx`
- `app/dashboard/layout.tsx`
- `app/dashboard/executivo/page.tsx`
- `app/dashboard/campanhas/page.tsx`
- `app/api/meta/campaigns/route.ts`
- `app/api/meta/performance/route.ts`
- `app/api/meta/compare/route.ts`
- `app/api/meta/vertical-budget/route.ts`
- `app/api/cron/sync-meta/route.js`
- `lib/meta-insights-store.ts`
- `lib/dashboard-query.ts`
- `lib/types.ts`
- `lib/pdf-generator.ts`
- `app/pdf/page.tsx`
- `docs/sql/meta_campaign_insights.sql`

## Estado atual resumido
A aplicação hoje já não é mais um dashboard que consulta a Meta em tempo real no carregamento principal. Ela opera como uma camada de BI leve:
- sincroniza Meta -> Supabase;
- lê Supabase -> dashboard;
- usa Meta apenas para enriquecimentos pontuais;
- suporta campanhas fora do estado estritamente ativo;
- possui budget mensal por vertical com ciclo Meta e imposto;
- possui comparativos de grupos e anúncios;
- possui duas visões de navegação no dashboard;
- gera PDF institucional com páginas dinâmicas.