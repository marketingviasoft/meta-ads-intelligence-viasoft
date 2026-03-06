# Regras de Negócio Oficiais

Este documento consolida as regras que devem ser preservadas no produto.

## 1) Fonte de verdade

- A fonte de dados é a Meta API.
- Não criar métricas inventadas.
- Não substituir números por aproximações sem necessidade.

## 2) Filtros de campanha

- Exibir somente campanhas:
  - ativas (`effective_status = ACTIVE`)
  - com veiculação ativa (`deliveryStatus = ACTIVE`)
- Campanhas sem veiculação não devem entrar na seleção padrão.

## 3) Períodos de análise da campanha

- Períodos permitidos: `7`, `14`, `28`, `30`.
- O dia atual nunca entra no período.
- Sempre comparar com período anterior equivalente.

## 4) Ciclo de faturamento Meta para orçamento por vertical

- Ciclo fixo: dia `24` até dia `23`.
- O texto exibido no card de orçamento deve refletir esse ciclo.
- Para cálculo do gasto do ciclo em andamento:
  - considerar dados até `ontem` (nunca o dia atual)
  - limitar ao fim do ciclo (dia 23).

## 5) Regra de teto + imposto

- Teto base de investimento por vertical: `R$ 535,00` (configurável em env).
- Imposto sobre investimento: `12,15%`.
- Demonstrativo deve deixar explícito:
  - valor investido
  - valor do imposto
  - total = investimento + imposto
- Escala da barra deve usar teto total (base + imposto).

## 6) Formatação de números

- Moeda em BRL (`pt-BR`): `R$ 0.000,00`.
- Percentuais em formato brasileiro.
- Datas em `pt-BR`.

## 7) Objetivo da campanha e métrica principal

- `TRAFFIC` -> cliques no anúncio
- `ENGAGEMENT` -> interações/resultados
- `RECOGNITION` -> visualizações/impressões
- `CONVERSIONS` -> resultados/conversões

## 8) Insights e recomendações

- Engine central: `utils/insights-engine.ts`.
- Regras mínimas:
  - detectar CTR abaixo da referência
  - detectar CPC elevado
  - detectar queda no comparativo
  - detectar custo por resultado elevado (`highCostPerResult`)
- Recomendações adaptativas por objetivo.
- Guardas de amostragem mínima para evitar falso alerta:
  - `INSIGHTS_MIN_IMPRESSIONS`
  - `INSIGHTS_MIN_CLICKS`
  - `INSIGHTS_MIN_RESULTS`

## 9) Cache e atualização

- TTL principal: `5 minutos`.
- Stale fallback: `15 minutos` (contingência).
- Botão `Atualizar Dados` deve forçar nova leitura e invalidar cache relevante.

## 10) PDF

- Geração backend (não usar html2canvas/jsPDF).
- Renderizar rota dedicada `/pdf`.
- Deve preservar leitura executiva do dashboard.
- Conteúdo deve evitar cortes de texto/gráfico e quebras incorretas de página.

## 11) Branding

- Nome oficial da publicação: `Meta Ads Intelligence | VIASOFT`.
- Branding institucional:
  - `public/logos/*`
- Ícones de verticais:
  - `public/icons/verticais/*`

## 12) Restrições operacionais

- Não expor token em frontend.
- Não commitar `.env.local`.
- Sem banco de dados no MVP atual.
- Sem autenticação no MVP atual.
