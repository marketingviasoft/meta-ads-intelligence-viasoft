# Handoff

## Estado atual
O projeto está operacional em arquitetura Supabase-first. O dashboard principal lê dados locais do Supabase para campanhas, performance, estrutura, comparativos e budget mensal por vertical. A Meta Graph API ficou concentrada na sincronização (`app/api/cron/sync-meta/route.js`) e em endpoints pontuais de preview/enriquecimento.

A navegação principal da aplicação também foi reorganizada em tres frentes:
- `Resumo Executivo` em `/dashboard/executivo`
- `Análise por Campanha` em `/dashboard/campanhas`
- `Sincronizações` em `/dashboard/sincronizacoes`

A home (`/`) redireciona para `/dashboard/executivo`.

## O que mudou em relação ao estado antigo e consolidação recente
- o dashboard tem uma visão executiva madura com tooltips e KPI visível de cliques;
- ranking "Top 3 Resultados por Objetivo" (foco em volume) implementado em quatro blocos fixos (`Conversão`, `Engajamento`, `Tráfego`, `Reconhecimento`);
- utilitários em `utils/objective.ts` e `utils/labels.ts` fornecem os labels amigáveis unificados;
- infraestrutura inicial de testes provisionada, ainda que parcial;
- campanhas deixaram de ser "somente ativas";
- existe opção padrão `Todas as verticais`;
- o filtro principal agora é `Veiculação`, com grupos simplificados;
- o budget mensal por vertical considera ciclo 24 -> 23 e imposto de 12,15%;
- VIASOFT possui teto total mensal de R$ 1.000,00 já considerando imposto;
- comparativos entre conjuntos de anúncios e anúncios passaram a ser parte do produto;
- PDF passou a ter página condicional de comparativos;
- Supabase é a camada central e final de leitura;
- o dashboard passou a operar com duas visões irmãs, preservando filtros globais por query string.
- a operação ganhou uma visão interna de observabilidade em `/dashboard/sincronizacoes`, lendo `meta_sync_logs`;
- a governança ganhou CI mínimo em `.github/workflows/ci.yml` e auditoria manual de schema em `.github/workflows/schema-audit.yml`.

## Pontos críticos para não quebrar
1. Não incluir o dia atual nas métricas de performance.
2. Incluir o dia atual (parcial) no card de budget mensal da vertical.
3. Manter ciclo de faturamento Meta em 24 -> 23.
4. Manter imposto Meta em 12,15%.
5. Manter exceção de budget da vertical VIASOFT.
6. Não remover `utils/insights-engine.ts`.
7. Preservar a leitura do dashboard e a paridade do PDF.
8. Não voltar a fazer chamadas síncronas/pesadas para Meta no carregamento do usuário.
9. Preservar o contrato de navegação entre visão executiva e visão analítica.

## Fluxo principal do dashboard

### Visão executiva
Fluxo esperado:
1. aplicar filtros globais diretamente nos seletores interativos da tela;
2. ler panorama consolidado da carteira (KPIs, gráfico neutro, distribuições, alocações e insights automáticos via `utils/executive-insights.ts`);
3. navegar para a análise detalhada por `campaignId` usando o atalho de drill-down na tabela.

### Visão analítica
Fluxo atual:
1. selecionar vertical;
2. selecionar veiculação/status;
3. selecionar campanha;
4. selecionar período.

## Contrato de navegação entre visões

### Rotas
- `/dashboard/executivo`
- `/dashboard/campanhas`
- `/dashboard/sincronizacoes`

### Parâmetros canônicos
- `verticalTag`
- `deliveryGroup`
- `rangeDays`
- `campaignId`

### Regras
- `verticalTag`, `deliveryGroup` e `rangeDays` são filtros globais preservados entre visões;
- `campaignId` é usado para drill-down na visão analítica;
- a visão executiva não deve depender de `campaignId` para renderizar;
- a visão analítica pode receber `campaignId` pela URL e fazer fallback seguro se ele não existir dentro da lista filtrada;
- a URL funciona como estado inicial das visões e como mecanismo de preservação dos filtros globais entre executivo e analítico.

## Fluxo da estrutura e comparativos
- A seção de estrutura mostra grupos e anúncios.
- O usuário pode marcar até 2 grupos e até 2 anúncios para comparar.
- As seções de comparativo aparecem somente quando existem 2 itens selecionados.
- As comparações usam a mesma família de métricas da campanha.

## PDF atual
Fluxo atual do PDF por campanha:
1. Header + seletores + budget mensal
2. Comparativos (condicional)
3. Cards de métricas
4. Tendência consolidada + performance diária
5. Insights + recomendações

Fluxo especial:
- se houver apenas `verticalTag`, o sistema gera PDF compacto de budget da vertical.

## Limitações conhecidas e Pendências Parciais
1. **Preview de anúncio**: ainda pode falhar por permissão/Meta, mas a UI agora diferencia melhor `Preview bloqueado pela Meta`, `Preview indisponivel` e `Criativo ainda nao enriquecido`.
2. **Nome de criativo**: continua dependente da qualidade do enriquecimento salvo no Supabase.
3. **Paginação do PDF**: deve continuar sendo derivada do fluxo real em `app/pdf/page.tsx`, inclusive quando a página de comparativos existir ou não.
4. **Acoplamento analítico/executivo**: as visões devem continuar desacopladas para não inflar o `DashboardClient`.
5. **Persistência de `objective_category` (Auditada no ambiente atual)**: O ambiente auditado em `2026-04-01` ja possui `objective_category` disponivel e populada no schema real. Ainda assim, ambientes paralelos/novos continuam podendo depender de `docs/sql/add_objective_category.sql`; por isso o fallback regex ainda nao deve ser removido sem nova auditoria.
6. **Logging do Cron (Ativo no ambiente auditado, observabilidade ainda simples)**: O ambiente auditado em `2026-04-01` ja possui `meta_sync_logs` ativo e o cron manual confirmou `syncLogPersistence = supabase`. O fallback `console.log`/`console.warn` continua existindo apenas como trilha de seguranca para ambientes sem a migration.
7. **Centralização de Constantes (Parcial)**: O ecossistema de valores mágicos avançou para `lib/constants.ts`, incluindo caps de budget compartilhados, mas ainda existem resquícios soltos fora da trilha principal.
8. **Cobertura de Testes (Parcial, mas ampliada)**: cron, payload executivo, contrato do PDF e fallbacks de preview agora possuem cobertura dedicada em `__tests__/`, mas a cobertura ainda nao e exaustiva em toda a aplicacao.

## Arquivos de maior impacto
- `lib/meta-insights-store.ts`
- `lib/dashboard-query.ts`
- `app/api/cron/sync-meta/route.js`
- `components/dashboard-client.tsx`
- `components/executive-dashboard-client.tsx`
- `components/dashboard-view-tabs.tsx`
- `components/dashboard-report.tsx`
- `components/campaign-structure-panel.tsx`
- `components/structure-comparison-section.tsx`
- `app/dashboard/layout.tsx`
- `app/dashboard/executivo/page.tsx`
- `app/dashboard/campanhas/page.tsx`
- `app/pdf/page.tsx`
- `lib/pdf-generator.ts`

## Próximos cuidados em qualquer nova feature
- sempre decidir primeiro se o dado será lido do Supabase ou da Meta;
- se impactar PDF, atualizar o contrato de paridade;
- se impactar filtro, atualizar docs e runbook;
- se impactar schema, atualizar SQL e cron juntos;
- se impactar navegação entre visões, preservar os parâmetros canônicos e o fluxo macro -> drill-down.
