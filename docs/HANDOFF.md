# Handoff Técnico Completo

Este arquivo é a memória operacional principal do projeto para continuidade entre ambientes (empresa/casa), sem depender do histórico de chat.

## 1) Contexto do produto

- Nome oficial da publicação: `Meta Ads Intelligence | VIASOFT`
- Stack:
  - Next.js App Router
  - TypeScript
  - Tailwind CSS
  - Recharts
  - Puppeteer (`puppeteer-core` + `@sparticuz/chromium`)
  - Sem banco de dados
  - Sem autenticação (MVP)
- Foco:
  - Leitura executiva da performance de Meta Ads
  - Clareza para usuários não especialistas
  - Exportação PDF fiel à leitura do dashboard

## 2) Estado atual do sistema (funcional)

### 2.1 Dashboard web

- Carrega campanhas via `GET /api/meta/campaigns`
- Exibe apenas campanhas:
  - `effective_status = ACTIVE`
  - e com `deliveryStatus = ACTIVE` (veiculação real)
- Seletores:
  - Vertical
  - Campanha ativa
  - Período (`7, 14, 28, 30` dias)
- Botões:
  - `Gerar PDF`
  - `Atualizar Dados` (força refresh e invalidação de cache)
- Seções:
  - Informações da campanha
  - Estrutura da campanha (adsets + anúncios ativos)
  - Cards de métricas com status e comparação
  - Tendência consolidada + semáforo executivo (Manter/Revisar/Intervir)
  - Gráfico de performance diária
  - Insights automáticos e recomendações por objetivo
  - Card de orçamento mensal por vertical (com imposto)

### 2.2 Estrutura de campanha (adsets e anúncios)

- `GET /api/meta/adsets?campaignId=...`
- `GET /api/meta/ads?adSetId=...`
- `GET /api/meta/ad-preview?adId=...`
- Painel mostra:
  - Grupos de anúncios ativos
  - Anúncios ativos do grupo selecionado
  - Miniatura de criativo
  - Nome do criativo
  - Destino (URL/WhatsApp)
  - Modal com preview avançado (iframe quando disponível)

### 2.3 Performance e insights

- `GET /api/meta/performance?campaignId=...&rangeDays=...`
- Retorna `DashboardPayload` com:
  - campanha
  - range e comparação vs período anterior
  - deltas por métrica
  - série diária (chart)
  - verticalBudget
  - insights
  - recomendações
  - generatedAt

### 2.4 PDF

- Endpoint: `GET /api/pdf?campaignId=...&rangeDays=...`
- Geração em backend via `lib/pdf-generator.ts`
- Compatível local + Vercel serverless:
  - local: usa Chrome local (ou `CHROME_EXECUTABLE_PATH`)
  - serverless: usa `@sparticuz/chromium` + `puppeteer-core`
- Formato atual:
  - A4 paisagem
  - `PDF_TOTAL_PAGES = 5` em `pdf/layout-preset.ts`

## 3) Regras críticas implementadas

- Verdade de dados: Meta API
- Dia atual excluído do período de performance
- Cache inteligente em memória por escopo:
  - campanhas
  - campanha+período
  - adsets
  - ads
  - ad preview
  - orçamento de vertical
- TTL cache: `5 min`
- Stale fallback: `15 min`
- Guardas de ambiente em todos endpoints `app/api/meta/*`:
  - `META_ACCESS_TOKEN` obrigatório
  - `META_AD_ACCOUNT_ID` obrigatório
- Engine de insights isolada em `utils/insights-engine.ts`

## 4) Orçamento de vertical (estado atual)

### 4.1 Ciclo

- Ciclo de faturamento Meta usado no card:
  - início fixo no dia `24`
  - fim fixo no dia `23` do mês seguinte
- Exibição no card:
  - `Ciclo de faturamento Meta: dd/mm/aaaa até dd/mm/aaaa`
- Coleta de dados:
  - até `dataUntil` (ontem, limitado ao fim do ciclo), para não incluir dia atual/futuro.

### 4.2 Teto e imposto

- Teto base de investimento por vertical:
  - `VERTICAL_MONTHLY_CAP_BRL` (default `535`)
- Imposto considerado no demonstrativo:
  - `12,15%`
- No card:
  - mostra valor investido
  - mostra saldo/excedente considerando total com imposto
  - mostra total explícito: `investimento + imposto = total`
  - barra dupla:
    - barra verde escura = investimento
    - barra verde clara = investimento + imposto
  - escala final usa teto total com imposto (aprox. `R$ 600,00` quando base `535`)

## 5) Branding e identidade visual

- Nome padrão da publicação:
  - `lib/branding.ts` -> `PUBLICATION_NAME = "Meta Ads Intelligence | VIASOFT"`
- Distinção de assets:
  - Branding geral: `public/logos/*`
  - Ícones de verticais: `public/icons/verticais/*`
- Observação importante:
  - Não misturar ícones de vertical com logo institucional em usos de branding.

## 6) Mapeamentos importantes

### 6.1 Objetivo -> métrica principal

- `TRAFFIC` -> cliques
- `ENGAGEMENT` -> resultados (interações)
- `RECOGNITION` -> impressões
- `CONVERSIONS` -> resultados (conversões)

### 6.2 Vertical

- Parse do nome da campanha em `utils/campaign-tags.ts`:
  - padrão: `[Agência] [Vertical] [Objetivo] ...`
- Campanhas fora do padrão:
  - entram como `Sem vertical`
  - na UI ficam visíveis somente em “Todas as verticais”

## 7) Módulos principais (referência rápida)

- Orquestração e cache: `lib/meta-dashboard.ts`
- Integração Meta API: `services/meta-api.ts`
- Tipos centrais: `lib/types.ts`
- Insights: `utils/insights-engine.ts`
- Cálculo de métricas: `utils/metrics.ts`
- Range dashboard: `utils/date-range.ts`
- Range ciclo vertical: `utils/month-range.ts`
- PDF backend: `lib/pdf-generator.ts`
- Página PDF: `app/pdf/page.tsx`
- Cliente UI: `components/dashboard-client.tsx`
- Relatório: `components/dashboard-report.tsx`
- Gráfico: `components/performance-chart.tsx`
- Estrutura de campanha: `components/campaign-structure-panel.tsx`

## 8) Pendências conhecidas / pontos de observação

1. Destino de anúncio pode aparecer como `Site (URL não identificada)` em alguns criativos.
   - A lógica de resolução é robusta (`services/meta-api.ts`), mas há casos de payload Meta sem URL utilizável.
   - Melhorar diagnóstico com logging controlado de campos de origem (sem token).

2. Layout PDF é sensível a altura do gráfico e blocos.
   - Ajustes recentes melhoraram, mas qualquer alteração de copy/padding pode impactar quebra de página.

3. Mobile:
   - Foram feitos ajustes de responsividade.
   - Sempre validar iPhone SE / 12 Pro / XR / 14 Pro Max ao mudar selectores e chart.

## 9) Como retomar rapidamente em outro ambiente

1. Abrir esta sequência:
   - `docs/HANDOFF.md`
   - `docs/BUSINESS_RULES.md`
   - `docs/SESSION_MEMORY.md`
   - `docs/RUNBOOK.md`
2. Rodar:
   - `npm install`
   - `npm run dev`
   - `npm run typecheck`
3. Validar fluxo:
   - campanhas
   - performance
   - adsets/ads/preview
   - PDF

## 10) Critérios para não quebrar continuidade

- Não remover `utils/insights-engine.ts`
- Preservar `generateInsights` e seus pilares:
  - baseline CTR/CPC
  - lógica `highCostPerResult`
  - recomendações por objetivo
- Não incluir dia atual em análises
- Não inventar métricas
- Respeitar formato monetário BRL
- Manter paridade visual dashboard/PDF quando alterar layout
