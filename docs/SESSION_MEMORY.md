# Session Memory

## Estado consolidado em 2026-03
Este arquivo registra o estado real do projeto depois da migracao para Supabase-first e das evolucoes posteriores feitas fora da sessao original.

## Decisoes estruturais que continuam valendo
- A camada principal de leitura e o Supabase.
- A Meta ficou concentrada no cron e em endpoints de preview/enriquecimento.
- O dashboard nao depende mais de consultas sincronao-pesadas para carregar metricas.
- O produto nao trabalha mais apenas com campanhas ativas.
- `Todas as verticais` e a opcao padrao do seletor.
- Budget mensal usa ciclo Meta 24 -> 23.
- Budget mensal considera imposto de 12,15%.
- VIASOFT possui teto total de R$ 1.000,00 com imposto.
- Comparativos de grupos e anuncios fazem parte do produto.
- A pagina de comparativos do PDF e condicional.

## Estado funcional atual
### Dashboard
- Header institucional e branding VIASOFT
- Seletores em ordem: Vertical -> Veiculacao -> Campanha -> Periodo
- Card de budget mensal da vertical
- Informacoes da campanha
- Estrutura da campanha
- Comparativo entre grupos de anuncios (condicional)
- Comparativo entre anuncios (condicional)
- Cards de metricas
- Tendencia consolidada
- Performance diaria
- Insights automaticos
- Recomendacoes por objetivo

### PDF
- Fluxo por campanha com pagina de comparativos opcional
- Fluxo compacto por vertical quando nao ha `campaignId`
- Renderizacao com Puppeteer Core + Chromium para Vercel

### Dados
- `meta_campaign_insights` na granularidade diaria por campanha/adset/ad
- `meta_adsets` e `meta_ads` como dimensoes locais
- Cron com `sync-meta-v3-fallback-safe`

## Limitacoes conhecidas mantidas em memoria
- Preview de anuncio ainda pode falhar por permissao da Meta.
- Nome do criativo e destino dependem do nivel de enriquecimento salvo localmente.
- A paginacao real do PDF precisa ser lida do fluxo do `app/pdf/page.tsx`, porque a quantidade de paginas pode variar conforme o conteudo exportado.

## Quando houver nova alteracao, lembrar de sincronizar
- `docs/DOCUMENTACAO_COMPLETA.md`
- `docs/HANDOFF.md`
- `docs/BUSINESS_RULES.md`
- `docs/RUNBOOK.md`
- `docs/PARITY_CONTRACT.json`
- `docs/sql/meta_campaign_insights.sql`
