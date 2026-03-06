# Prompt de Retomada (Casa/Empresa)

Copie e cole o texto abaixo no início de uma nova conversa:

```txt
Quero retomar exatamente o desenvolvimento do projeto Meta Ads Intelligence | VIASOFT.

Antes de qualquer ação, leia obrigatoriamente estes arquivos do repositório:
1) docs/HANDOFF.md
2) docs/BUSINESS_RULES.md
3) docs/SESSION_MEMORY.md
4) docs/RUNBOOK.md

Depois de ler:
- Faça um resumo objetivo do estado atual (arquitetura, regras críticas e pendências).
- Liste os 3 próximos passos mais importantes em ordem de prioridade.
- Só então continue a implementação, sem quebrar as regras de negócio documentadas.

Regras de continuidade:
- Não remover utils/insights-engine.ts.
- Não incluir o dia atual nos cálculos de performance.
- Manter ciclo de faturamento Meta da vertical em 24 -> 23.
- Manter demonstrativo de orçamento com imposto de 12,15%.
- Preservar paridade visual dashboard/PDF.
- Não expor tokens/segredos.

Agora comece pela validação do estado local:
- npm run typecheck
- apontar se há divergências entre código atual e documentação.
```

## Versão curta (quando quiser ir direto)

```txt
Leia docs/HANDOFF.md, docs/BUSINESS_RULES.md, docs/SESSION_MEMORY.md e docs/RUNBOOK.md.
Retome o projeto Meta Ads Intelligence | VIASOFT exatamente do ponto atual, sem perder regras.
Comece com um resumo do estado + próximos 3 passos prioritários e siga para execução.
```
