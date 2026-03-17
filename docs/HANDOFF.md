# Handoff

## Estado atual
O projeto esta operacional em arquitetura Supabase-first. O dashboard principal le dados locais do Supabase para campanhas, performance, estrutura, comparativos e budget mensal por vertical. A Meta Graph API ficou concentrada na sincronizacao (`app/api/cron/sync-meta/route.js`) e em endpoints pontuais de preview/enriquecimento.

## O que mudou em relacao ao estado antigo
- campanhas deixaram de ser "somente ativas";
- existe opcao padrao `Todas as verticais`;
- o filtro principal agora e `Veiculacao`, com grupos simplificados;
- o budget mensal por vertical considera ciclo 24 -> 23 e imposto de 12,15%;
- VIASOFT possui teto total mensal de R$ 1.000,00 ja considerando imposto;
- comparativos entre grupos de anuncios e anuncios passaram a ser parte do produto;
- PDF passou a ter pagina condicional de comparativos;
- Supabase virou a camada central de leitura.

## Pontos criticos para nao quebrar
1. Nao incluir o dia atual nas metricas de performance.
2. Incluir o dia atual (parcial) no card de budget mensal da vertical.
3. Manter ciclo de faturamento Meta em 24 -> 23.
4. Manter imposto Meta em 12,15%.
5. Manter excecao de budget da vertical VIASOFT.
6. Nao remover `utils/insights-engine.ts`.
7. Preservar a leitura do dashboard e a paridade do PDF.
8. Nao voltar a fazer chamadas sincronao-pesadas para Meta no carregamento do usuario.

## Fluxo principal do dashboard
1. Selecionar vertical.
2. Selecionar veiculacao/status.
3. Selecionar campanha.
4. Selecionar periodo.

## Fluxo da estrutura e comparativos
- A secao de estrutura mostra grupos e anuncios.
- O usuario pode marcar ate 2 grupos e ate 2 anuncios para comparar.
- As secoes de comparativo aparecem somente quando existem 2 itens selecionados.
- As comparacoes usam a mesma familia de metricas da campanha.

## PDF atual
Fluxo atual do PDF por campanha:
1. Header + seletores + budget mensal
2. Comparativos (condicional)
3. Cards de metricas
4. Tendencia consolidada + performance diaria
5. Insights + recomendacoes

Fluxo especial:
- se houver apenas `verticalTag`, o sistema gera PDF compacto de budget da vertical.

## Limitacoes conhecidas
- preview de anuncio ainda pode falhar por permissao/Meta;
- nome de criativo e destino dependem da qualidade do enriquecimento salvo no Supabase;
- `PDF_TOTAL_PAGES` ainda e uma constante legada e nao substitui a leitura do fluxo real em `app/pdf/page.tsx`.

## Arquivos de maior impacto
- `lib/meta-insights-store.ts`
- `app/api/cron/sync-meta/route.js`
- `components/dashboard-client.tsx`
- `components/dashboard-report.tsx`
- `components/campaign-structure-panel.tsx`
- `components/structure-comparison-section.tsx`
- `app/pdf/page.tsx`
- `lib/pdf-generator.ts`

## Proximos cuidados em qualquer nova feature
- sempre decidir primeiro se o dado sera lido do Supabase ou da Meta;
- se impactar PDF, atualizar o contrato de paridade;
- se impactar filtro, atualizar docs e runbook;
- se impactar schema, atualizar SQL e cron juntos.
