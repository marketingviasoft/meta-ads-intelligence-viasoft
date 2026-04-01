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
- Aplicar `docs/sql/meta_sync_logs.sql` se quiser persistencia de execucoes do cron no Supabase; sem isso o cron segue com fallback em console.

### Comandos uteis
```bash
npm install
npm run dev
npm run typecheck
npm run lint
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
  "syncVersion": "sync-meta-v3-fallback-safe",
  "fetchedRows": 327,
  "syncedInsights": 327,
  "syncedAdSets": 29,
  "syncedAds": 69,
  "jobsExecuted": 1,
  "range": {
    "since": "2026-02-11",
    "until": "2026-03-12"
  }
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

Acao:
- validar se o anuncio existe no Supabase
- validar se o preview depende de rota Meta-direct
- tratar como limitacao esperada quando a Meta negar acesso

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
