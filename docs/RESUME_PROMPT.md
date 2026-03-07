# Prompt de Retomada (Casa/Empresa)

Copie e cole este prompt no início de uma nova conversa:

```txt
Quero retomar exatamente o desenvolvimento do projeto Meta Ads Intelligence | VIASOFT.

Antes de qualquer ação, leia obrigatoriamente estes arquivos:
1) docs/DOCUMENTACAO_COMPLETA.md
2) docs/HANDOFF.md
3) docs/BUSINESS_RULES.md
4) docs/SESSION_MEMORY.md
5) docs/RUNBOOK.md

Depois de ler:
- Faça um resumo objetivo do estado atual (arquitetura, regras críticas, riscos e pendências).
- Liste os 3 próximos passos mais importantes em ordem de prioridade.
- Aponte divergências entre código e documentação, se houver.
- Só então continue a implementação.

Regras de continuidade:
- Não remover utils/insights-engine.ts.
- Não incluir o dia atual nos cálculos de performance.
- Manter ciclo de faturamento da vertical em 24 -> 23.
- Manter imposto de 12,15% no demonstrativo de orçamento.
- Preservar paridade de leitura entre dashboard e PDF.
- Não expor tokens/segredos.

Comece validando o estado local com:
- npm run typecheck
- npm run lint
```

## Versão curta

```txt
Leia docs/DOCUMENTACAO_COMPLETA.md, docs/HANDOFF.md, docs/BUSINESS_RULES.md, docs/SESSION_MEMORY.md e docs/RUNBOOK.md.
Resuma estado atual + 3 próximos passos prioritários + divergências entre código e documentação.
Depois siga com implementação sem quebrar as regras de continuidade.
```
