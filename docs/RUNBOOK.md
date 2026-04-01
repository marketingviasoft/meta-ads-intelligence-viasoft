# Runbook operacional

## 1. Preparacao local
### Requisitos
- Node.js instalado e funcional
- `.env.local` configurado
- Supabase acessivel pelas variaveis do projeto
- Meta token configurado server-side

### Migracoes operacionais recomendadas
- Aplicar `docs/sql/meta_campaign_insights.sql` no ambiente alvo para garantir a coluna `objective_category` no schema principal.
- Em ambientes ja existentes, validar tambem `docs/sql/add_objective_category.sql` caso a coluna ainda nao exista.
- Aplicar `docs/sql/meta_sync_logs.sql` para persistencia de execucoes do cron no Supabase.
- Ambiente auditado em `2026-04-01`: `objective_category` e `meta_sync_logs` disponiveis no schema real.

### Comandos uteis
```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run check:quality
npm run check:schema
```

### Dashboard
1. Subir `npm run dev`
2. Abrir `http://localhost:3000` (redirecionará para `/dashboard/executivo`)
3. Validar Visão Executiva:
   - seletores interativos
   - cards de KPI consolidados
   - gráfico de evolução da carteira
   - painéis de distribuição (objetivo, vertical, status)
   - rankings (top resultados e alocações)
   - insights de carteira
   - tabela de listagem e botão de drill-down analítico
4. Validar Visão Analítica (/dashboard/campanhas):
   - header e branding
   - seletores
   - budget mensal
   - campanha
   - estrutura
   - comparativos (se houver selecao)
   - metricas
   - tendencia
   - grafico
   - insights/recomendacoes
1. Selecionar campanha ou vertical
2. Acionar `Gerar PDF`
3. Validar se a ordem das paginas bate com o contrato atual
4. Validar se o PDF respeita a mesma leitura do dashboard
5. Validar Observabilidade (/dashboard/sincronizacoes):
   - status das ultimas execucoes
   - duracao
   - range sincronizado
   - contagem de insights/adsets/ads
   - erro detalhado quando houver

## 3. Sync manual da Meta -> Supabase
### Localhost
```bash
curl.exe -X GET "http://localhost:3000/api/cron/sync-meta" -H "Authorization: Bearer <CRON_SECRET>"
```

### Vercel
```bash
curl.exe -X GET "https://SEU-DOMINIO/api/cron/sync-meta" -H "Authorization: Bearer <CRON_SECRET>"
```

### Resposta esperada
Exemplo de sucesso:
```json
{
  "success": true,
  "syncVersion": "sync-meta-v4-shared-resolution",
  "fetchedRows": 239,
  "syncedInsights": 239,
  "syncedAdSets": 27,
  "syncedAds": 57,
  "jobsExecuted": 1,
  "range": {
    "since": "2026-03-03",
    "until": "2026-04-01"
  },
  "syncLogPersistence": "supabase"
}
```

## 4. Cron na Vercel
Arquivo:
- `vercel.json`

Expressao atual:
- `0 3 * * *`

Importante:
- a Vercel interpreta cron em UTC;
- plano Hobby tem limitacoes e precisa respeitar a documentacao oficial da Vercel;
- quando houver duvida, validar a rota manualmente com `curl`.

## 4.1. CI e governanca
Workflow continuo:
- `.github/workflows/ci.yml`
- roda em `push`/`pull_request` com:
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`
  - `npm run check:rules`
  - `npm run check:parity`

Workflow manual de schema:
- `.github/workflows/schema-audit.yml`
- executar apenas por `workflow_dispatch`
- ambiente recomendado: `schema-audit`
- requer secrets para montar `.env.local`
- roda `npm run check:schema`

Importante:
- `check:schema` depende de ambiente real e nao deve ser promovido a check cego em todo PR;
- manter a auditoria de schema como passo manual/protegido.

## 5. Validacao dos filtros
Ao testar os seletores, sempre verificar:
- Vertical filtra catalogo e budget
- Veiculacao filtra a lista de campanhas
- Campanha muda estrutura, metricas e comparativos
- Periodo muda dashboard, comparativos e PDF

## 6. Validacao do budget mensal
Checklist:
- Se vertical = `Todas as verticais`, mostrar mensagem pedindo selecao especifica
- Se vertical especifica, mostrar:
  - total do ciclo com imposto
  - saldo disponivel
  - valor aplicado em campanhas
  - imposto
  - barra de progresso
- Garantir que o periodo exibido use ciclo 24 -> 23
- Garantir que o dashboard inclua o dia atual como parcial no budget

## 7. Validacao dos comparativos
### Grupos de anuncios
- selecionar exatamente 2 grupos
- conferir surgimento da secao `Comparativo entre grupos de anuncios`
- validar metricas exibidas

### Anuncios
- selecionar exatamente 2 anuncios
- conferir surgimento da secao `Comparativo entre anuncios`
- validar metricas exibidas

## 8. Problemas conhecidos e leitura rapida
### Preview de anuncio falha
Causa comum:
- permissao da Meta
- preview indisponivel
- asset restrito
- criativo ainda nao enriquecido no Supabase

Acao:
- validar se o anuncio existe no Supabase
- validar se o preview depende de rota Meta-direct
- usar a mensagem exibida na UI para diferenciar `Preview bloqueado pela Meta`, `Preview indisponivel` e `Criativo ainda nao enriquecido`

### Nome de criativo ou destino ausente
Causa comum:
- enriquecimento nao sincronizado completamente
- campo nao exposto pela Meta naquele criativo
- fallback seguro aplicado no backend

Acao:
- rodar sync manual
- revisar logs do cron
- revisar valores em `meta_ads`

### PDF desalinhado
Acao:
- revisar `app/pdf/page.tsx`
- revisar `lib/pdf-generator.ts`
- revisar `docs/PARITY_CONTRACT.json`
- validar se a pagina de comparativos deveria ou nao existir

## 9. Arquivos para revisar primeiro em caso de incidente
- `app/api/cron/sync-meta/route.js`
- `lib/meta-insights-store.ts`
- `app/api/meta/campaigns/route.ts`
- `app/api/meta/performance/route.ts`
- `app/api/meta/compare/route.ts`
- `app/api/meta/ad-preview/route.ts`
- `app/api/pdf/route.ts`
- `app/pdf/page.tsx`
- `lib/pdf-generator.ts`

## 10. Regras que nunca devem ser esquecidas
- performance sem dia atual
- budget com dia atual parcial
- ciclo 24 -> 23
- imposto de 12,15%
- VIASOFT com teto total de R$ 1.000,00
- Supabase-first para leitura do dashboard
- PDF e dashboard devem contar a mesma historia
