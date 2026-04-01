# Memória Operacional de Retomada (Session Memory)

Este arquivo é a memória operacional de contexto para futuras IAs e retomadas do projeto.  
Leia este documento antes de inferir status de funcionalidades, propor arquitetura ou continuar implementação.

## Onde Paramos (Março 2026)

O projeto está operando com arquitetura **Supabase-first** para leitura do dashboard.  
A visão executiva deixou de ser placeholder e passou a ser uma tela gerencial funcional, com KPIs consolidados, filtros interativos, ranking por objetivo, gráfico consolidado, insights e drill-down para a visão analítica.

A visão analítica continua sendo a leitura profunda por campanha, com grupos de anúncios, anúncios, comparativos, relatório e PDF.

## Estado Atual Consolidado

- **Dashboard Supabase-first**: a leitura gerencial e analítica ocorre principalmente a partir do Supabase; integrações Meta ficam concentradas na ingestão via cron e em pontos pontuais como preview.
- **Visão Executiva reestruturada**: topo com KPI de **Cliques**, tooltips nos KPIs e remoção de **“Ações no Objetivo”**.
- **Top 3 Resultados por Objetivo**: ranking focado em volume de resultados distribuído em 4 agrupamentos fixos:
  - `Conversão`
  - `Engajamento`
  - `Tráfego`
  - `Reconhecimento`
- **Camada semântica centralizada**: uso de `utils/objective.ts` e `utils/labels.ts` para manter consistência técnica e visual.
- **Navegação entre visões consolidada**: o fluxo entre `/dashboard/executivo` e `/dashboard/campanhas` preserva o contexto por query string.
- **Visão Executiva madura visualmente**: KPIs com tooltip, leitura mais limpa e semântica mais amigável para público gerencial.

## Pendências Parciais (Não tratar como concluídas)

- **`objective_category`**: o código e o schema principal já foram alinhados para a coluna, mas a transição ainda depende de migração nos ambientes existentes; o fallback por regex continua relevante.
- **Logging do cron**: o código já tenta persistir em `meta_sync_logs`, porém isso ainda depende de migration manual e mantém `console.log` como fallback, sem telemetria madura.
- **Testes**: infraestrutura com Vitest existe, mas a cobertura ainda é preliminar.
- **Constantes**: centralização ainda incompleta, especialmente em partes do cron.
- **Dependência operacional de schema**: alguns ambientes podem exigir aplicação manual das migrações SQL para suportar `objective_category` e `meta_sync_logs`.
- **Fallback legado**: a inferência por regex ainda não deve ser removida sem validar a consolidação completa do schema e do fluxo de ingestão.

## Regras que Não Podem Ser Quebradas

- **Performance não inclui o dia atual**.
- **Budget mensal por vertical inclui a fração do dia atual**.
- **Budget por vertical**:
  - teto final de **R$ 1.000,00 para a VIASOFT**, já com imposto Meta embutido;
  - teto final de **R$ 600,00 para cada demais vertical**, já com imposto Meta embutido;
  - isso equivale a uma base de gasto de **R$ 891,67** para a VIASOFT e **R$ 535,00** para as demais verticais, para que ao final, com **12,15%** de imposto, atinjam o teto máximo.
- **Ciclo Meta** segue a janela **24 -> 23**.
- **Navegação entre Executivo e Analítico** depende de `verticalTag`, `deliveryGroup` e `rangeDays` preservados na URL.
- **Regras de orçamento, imposto e exceções por vertical** devem continuar ancoradas em `docs/BUSINESS_RULES.md` e `lib/constants.ts`.
- **Não inventar equivalência absoluta entre objetivos diferentes** ao comparar campanhas no executivo.

## O que Foi Implementado Recentemente

- KPI de **Cliques** no topo do Resumo Executivo.
- Tooltips explicativos nos KPIs do topo.
- Remoção da métrica **“Ações no Objetivo”** do topo executivo.
- Reorganização do ranking para foco em volume: **Top 3 Resultados por Objetivo**.
- Correção no drill-down para a visão analítica preservando perfeitamente o `initialCampaignId`.
- Tipografia global alterada para a fonte **Inter**.
- Consolidação dos labels amigáveis de objetivo e status em utilitários compartilhados.
- Melhor alinhamento da navegação executiva com a visão analítica.
- Melhor documentação de retomada e contexto em `README.md`, `HANDOFF.md`, `DOCUMENTACAO_COMPLETA.md` e neste próprio arquivo.

## Dependências Operacionais que Exigem Atenção

- Verificar se a migração `docs/sql/add_objective_category.sql` foi aplicada no banco do ambiente atual.
- Validar se o `.env.local` aponta para o projeto Supabase correto.
- Ao trocar de máquina/ambiente, não assumir que o schema está atualizado só porque o código está.
- Se houver erro na rota `/api/meta/executive`, suspeitar primeiro de:
  - variáveis de ambiente;
  - pacote do Supabase não instalado;
  - schema desatualizado (`objective_category` ausente).

## Próximos Passos Naturais

1. **Auditar o schema** e validar a consolidação real de `objective_category`.
2. **Evoluir logging/observabilidade do cron**.
3. **Aumentar cobertura de testes** nas regras críticas.
4. **Continuar a limpeza das constantes** ainda espalhadas.
5. **Continuar refinando a visão executiva**, mas sem quebrar a coerência semântica entre objetivos e métricas.

## Arquivos/Camadas Mais Sensíveis

- `lib/meta-insights-store.ts`
- `app/api/cron/sync-meta/route.js`
- `app/api/meta/executive/route.ts`
- `components/executive-dashboard-client.tsx`
- `components/metric-card.tsx`
- `utils/objective.ts`
- `utils/labels.ts`
- `docs/sql/meta_campaign_insights.sql`
- `docs/sql/add_objective_category.sql`

## Regra de Ouro para Futuras IAs

Antes de propor mudança:
1. verificar este arquivo;
2. verificar `docs/HANDOFF.md`;
3. verificar `docs/DOCUMENTACAO_COMPLETA.md`;
4. conferir o código real antes de assumir que algo está concluído;
5. marcar explicitamente como **parcial** tudo que ainda depende de migração, cobertura de testes ou observabilidade não consolidada.
