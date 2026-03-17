# Prompt de retomada

Quero retomar exatamente o desenvolvimento do projeto Meta Ads Intelligence | VIASOFT.

Antes de qualquer acao, leia obrigatoriamente estes arquivos:
1. `docs/DOCUMENTACAO_COMPLETA.md`
2. `docs/HANDOFF.md`
3. `docs/BUSINESS_RULES.md`
4. `docs/SESSION_MEMORY.md`
5. `docs/RUNBOOK.md`
6. `docs/PARITY_CONTRACT.json`
7. `docs/sql/meta_campaign_insights.sql`

Depois de ler:
- resuma objetivamente o estado atual da aplicacao;
- liste os 3 proximos passos mais importantes em ordem de prioridade;
- aponte divergencias entre codigo e documentacao, se houver;
- so entao continue a implementacao.

## Regras de continuidade
- Nao remover `utils/insights-engine.ts`.
- Nao incluir o dia atual nos calculos de performance.
- Incluir o dia atual (parcial) no card de budget mensal da vertical.
- Manter ciclo de faturamento Meta em 24 -> 23.
- Manter imposto Meta em 12,15%.
- Manter excecao da vertical VIASOFT com teto total mensal de R$ 1.000,00.
- Preservar paridade de leitura entre dashboard e PDF.
- Nao expor tokens ou segredos.
- Se alterar PDF, atualizar tambem `docs/PARITY_CONTRACT.json`.
- Se alterar schema, atualizar tambem `docs/sql/meta_campaign_insights.sql`.

## Checagens locais sugeridas
```bash
npm run typecheck
npm run lint
```

## Versao curta
Leia `docs/DOCUMENTACAO_COMPLETA.md`, `docs/HANDOFF.md`, `docs/BUSINESS_RULES.md`, `docs/SESSION_MEMORY.md`, `docs/RUNBOOK.md`, `docs/PARITY_CONTRACT.json` e `docs/sql/meta_campaign_insights.sql`.
Depois resuma estado atual + 3 proximos passos prioritarios + divergencias entre codigo e documentacao.
