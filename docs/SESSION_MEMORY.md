# Session Memory

## Ponto Exato de Retomada (Março/2026)
A aplicação está consolidada em uma arquitetura Supabase-first real-time (para leitura) e cron-based (para ingestão), com foco recém-aplicado na evolução da visão executiva e na navegação analítica.
Paramos após aprofundar lógica de **inferência de categorias de objetivo (`objective_category`)** e refatorar a visão executiva com novos KPIs macro (agora equipada com a métrica de Cliques) e tooltips textuais autoexplicativos.

## O que foi implementado e consolidado recentemente
- **Visão Executiva Madura**: Layout gerencial com KPIs consolidados (Investimentos, Impressões, Cliques) e tooltips explicativos explícitos nos cards principais.
- **Top 3 Eficiências por Objetivo**: Painel refatorado contendo exatamente 4 categorias fixas de agrupamento (`Conversão`, `Engajamento`, `Tráfego`, `Reconhecimento`).
- **Labels Amigáveis e Utilitários Semânticos**: Centralização forte e baseada em `utils/objective.ts` e `utils/labels.ts` para uniformidade semântica da aplicação.
- **Arquitetura Supabase-first Real**: Não disparamos hooks para a Meta no carregamento dos visões de campanhas. Tudo bate no banco.
- **Infraestrutura em Código**: Disposição básica e ativa de Vitest (`__tests__/`).

## Pendências Parciais (Tratar como INCOMPLETAS ou PARCIAIS)
- **Migração de Schema (`objective_category`)**: O recurso depende da consolidação do `docs/sql/add_objective_category.sql` na base do cliente e do cron. A rotina de utilitários possui resiliência (fallback robusto regex) justamente porque a transição é vista como parcial/manual para retrocompatibilidade.
- **Cobertura de Testes**: Não tratar como robusta ou madura. Há infraestrutura funcional, mas com cobertura em estágio inicial.
- **Monitoramento/Logging do Cron**: Não temos log consolidado. O cron na Vercel respira via `console.log` isolado puramente em texto.
- **Constantes de Negócio Reais**: Nem todo o arcabouço lógico foi empurrado para o `lib/constants.ts`; o cron ainda aloja regras hardcoded.
- **Melhorias de Tela Particionadas**: Há aprofundamentos visuais de resoluções de destino link/imagens parcialmente consolidados.

## Pontos Sensíveis de Negócio (O que NÃO Quebrar)
- **Filtros Globais via URL**: Parâmetros como `verticalTag`, `deliveryGroup` e `rangeDays` determinam a fonte da verdade e o elo entre a tela Executiva e a área de Campanhas.
- **Ciclo do Faturamento Financeiro Meta**: Cuidar da restrição mágica do **dia 24 ao dia 23**.
- **Imposto Retido**: A aplicação cobra e apresenta logicamente o teto com acréscimo de **12,15%**.
- **Exceção Exclusiva da Vertical VIASOFT**: Teto cravado total de **R$ 1.000,00** já abraçando o percentual de imposto.
- **Corte de Período Atual**: A visualização diária no Chart/Performance descarta rigidamente o "hoje"; mas o Card de Orçamento o abrange como fracionado.

## Próximos Passos Lógicos e Naturais
1. **Validar Schema Físico de Categorias**: Observar o cruzamento real da coluna nova `objective_category` nos dados do cron versus inferência regex de fallback.
2. **Investir em Test Coverage da Base de Utilitários**: Aplicar Vitest nas normalizações semânticas e categorizações brutas.
3. **Maturidade das Rotinas de Logging**: Ampliar telemetria do app/api/cron para escapar do isolamento visual dos `console.log`.
