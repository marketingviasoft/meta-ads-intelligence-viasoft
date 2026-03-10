# Memória de Sessão (Linha do Tempo)

Última atualização: 2026-03-06

Este arquivo registra decisões e mudanças relevantes para manter continuidade técnica.

## 0) Princípios definidos

- Produto executivo para leitura de Meta Ads.
- Linguagem clara para público não especialista.
- Meta API como fonte de verdade.
- Sem banco e sem autenticação no MVP.
- PDF obrigatório via backend.

## 1) Estrutura base estabilizada

- Projeto consolidado em:
- `app`, `components`, `lib`, `services`, `utils`, `pdf`, `docs`.
- Build e tipagem estabilizados para App Router.

## 2) Integração Meta API consolidada

- Endpoints internos padronizados:
- campaigns
- performance
- adsets
- ads
- ad-preview
- cache invalidate
- Tratamento de erro unificado para UI.
- Validação de env em rotas meta.

## 3) Regras de seleção e estrutura

- Campanhas filtradas por status ativo + entrega ativa.
- Estrutura por campanha implementada:
- ad sets ativos
- ads ativos
- preview avançado em modal
- resolução de destino (site/WhatsApp/Messenger etc.)

## 4) Camada analítica

- Cálculo de métricas por objetivo em `utils/metrics.ts`.
- Tendência consolidada e deltas habilitados.
- Semáforo executivo (`MANTER`, `REVISAR`, `INTERVIR`) ativo.
- Engine de insights preservada em `utils/insights-engine.ts`.

## 5) Orçamento de vertical

- Ciclo fixo 24 -> 23 implementado em `utils/month-range.ts`.
- Cálculo até a data atual (dia atual parcial).
- Teto base default `R$ 535`.
- Demonstrativo com imposto de 12,15%.

## 6) PDF

- Fluxo backend com Puppeteer em `lib/pdf-generator.ts`.
- Compatibilidade local + serverless consolidada.
- Estrutura atual em 5 páginas.
- Espera de prontidão via `PdfReadyFlag`.

## 7) Cache e contingência

- Cache em memória com TTL 5 min.
- Fallback stale de 15 min.
- Refresh manual via `refresh=1`.
- Invalidação explícita disponível por endpoint dedicado.

## 8) Branding e UI

- Nome oficial padronizado: `Meta Ads Intelligence | VIASOFT`.
- Separação entre branding institucional e ícones de verticais.
- Dashboard e PDF mantêm linguagem visual consistente.

## 9) Pontos ainda sensíveis

1. Algumas URLs finais de anúncios continuam dependentes de sinais incompletos da Meta API.
2. Ajustes de layout no PDF podem impactar paginação.
3. Cache em memória não cobre cenário multi-instância distribuído.

## 10) Atualização recente de documentação

- Revisão criteriosa dos documentos de `docs/` para:
- corrigir encoding e grafia;
- alinhar regras ao comportamento real da aplicação;
- remover ambiguidades sobre refresh/cache;
- sincronizar `RUNBOOK`, `BUSINESS_RULES`, `HANDOFF`, `RESUME_PROMPT` e `DOCUMENTACAO_COMPLETA`.

## 11) Ajuste funcional recente: vertical sem campanha ativa

- Seletor de vertical passou a operar com lista fixa:
- `VIASOFT`, `Agrotitan`, `Construshow`, `Filt`, `Petroshow`, `Voors`.
- Novo endpoint interno: `GET /api/meta/vertical-budget?verticalTag=...`.
- Card de orçamento mensal da vertical agora independe de campanha ativa.
- Quando a vertical selecionada não possui campanha ativa:
- orçamento mensal continua sendo exibido;
- UI exibe aviso de ausência de campanhas ativas para a vertical.

## 12) Ajuste de confiabilidade no somatório mensal da vertical

- No `fetchVerticalSpendInMonthRange`, o somatório passou a considerar apenas campanhas com:
- `impressions > 0` no período (houve veiculação);
- `spend > 0` no período (houve gasto real).
- Objetivo: aproximar o cálculo interno do filtro "Tiveram veiculação" do Ads Manager.

## 13) Diagnóstico de divergência Petroshow (172,88 vs 179,27)

- Divergência confirmada como diferença de janela temporal:
- `2026-02-24` até `2026-03-05` (até ontem) = `R$ 172,88`;
- `2026-02-24` até `2026-03-06` (inclui dia atual) = `R$ 179,27`.
- Ajuste aplicado na UI do card: exibir explicitamente a data-limite de acúmulo (`dataUntil`) com nota de inclusão/exclusão do dia atual.

## 14) Decisão de produto: modelo híbrido de período

- Performance comparativa continua sem dia atual (`until = ontem`).
- Orçamento mensal da vertical passa a incluir dia atual (parcial no momento da consulta).
- `VerticalBudgetSummary` passou a expor `includesCurrentDay`.

## 15) Padronização visual do aviso sem campanha ativa

- O aviso "Não há nenhuma campanha ativa para a vertical selecionada." passou a usar `surface-panel`.
- Objetivo: manter consistência visual com os demais cards do dashboard.

## 16) Reestruturação visual do card de orçamento vertical

- Card reorganizado em três blocos: resumo principal, métricas compactas e barra de consumo.
- Redução de textos redundantes e melhoria de hierarquia visual.
- Títulos e valores alinhados verticalmente entre os dois blocos de topo.
- Legenda da barra movida para depois das referências de faixa (`R$ 0,00` até teto).

## 17) Ajuste de redundância no card de orçamento

- Linhas "Ciclo Meta" e "Acumulado até" foram unificadas em uma única linha de período.
- Linha "Total com imposto" foi removida do card de saldo para reduzir repetição.
- Bloco de métricas compactas removeu "Valor investido" (já exibido no destaque principal).

## 18) Destaque principal agora exibe total com imposto

- No card de orçamento, o valor principal de investimento passou a mostrar `investido + imposto`.
- Objetivo: alinhar a leitura com o teto total de controle (`R$ 600,00` no cenário padrão com imposto).
- O valor investido sem imposto ficou no bloco secundário ("Valor investido").

## 19) Ajuste visual de soma (investimento + imposto)

- Cards secundários passaram a seguir leitura de soma: `valor aplicado em campanhas + imposto`.
- Inserido ícone `+` entre os dois cards para reforçar visualmente a composição do total.
- Título do card de investimento foi refinado para `Valor aplicado em campanhas`.

## 20) Aproveitamento de espaço nos cards principais de orçamento

- Card de investimento passou a exibir chips de contexto de ciclo (`dias corridos` e `data de fechamento`).
- Card de saldo passou a exibir chips de contexto operacional (`consumo do teto` e `dias restantes`).
- Objetivo: reduzir área ociosa e melhorar densidade informativa sem poluir a leitura.

## 21) Ajuste de layout sem informações extras no card de orçamento

- Removidos os chips adicionados na etapa anterior para evitar poluição visual.
- Reorganização manteve somente dados já existentes:
- período no rodapé do card de investimento;
- teto e consumo no rodapé do card de saldo;
- barra com cabeçalho mais limpo (somente referência de teto).

## 22) Correção de posicionamento conforme referência visual aprovada

- `Consumo do teto total` voltou para o cabeçalho do bloco da barra.
- Card de saldo mantém apenas `Teto total do ciclo` no rodapé.
- Objetivo: alinhar ao layout de referência aprovado pelo usuário.

## 23) Quatro blocos em linha no resumo de orçamento

- Resumo superior do card de orçamento foi unificado em um único grid responsivo:
- `1 coluna` no mobile, `2 colunas` em telas médias, `4 colunas` em telas grandes.
- Blocos incluídos: total com imposto, saldo disponível, valor aplicado e imposto.
- Removido ícone de `+` central para simplificar leitura em layout horizontal.

## 24) Reversão do layout em quatro blocos

- A proposta de 4 blocos em linha foi revertida por preferência visual.
- Layout restaurado para:
- 2 cards principais na primeira linha;
- linha secundária com `Valor aplicado` + ícone `+` + `Imposto`.

## 25) Correção de usabilidade nos seletores (fechamento no clique)

- Ajuste estrutural nos três seletores customizados: `vertical`, `campanha` e `período`.
- Contêiner externo mudou de `<label>` para `<div>` para evitar re-disparo de clique no gatilho.
- Resultado esperado: ao selecionar um item, o dropdown fecha imediatamente (desktop e mobile).

## 26) Ajuste visual de estado desativado nos seletores

- Nos seletores de `campanhas` e `período`, o estado desativado deixou de usar cursor de bloqueio.
- Estilo desativado prioriza aparência acinzentada (`bg`, `texto` e `borda`) com cursor padrão.

## 27) Reforço visual do estado desativado em campanhas/período

- Estado desativado ficou mais evidente com:
- rótulo acinzentado;
- campo com fundo cinza, borda cinza clara e sombra interna suave;
- texto e ícone em tom reduzido para sinalizar indisponibilidade.

## 28) Ajuste final de feedback visual de indisponibilidade

- Seletores de `campanhas` e `período` passaram a exibir badge `Indisponível` quando desativados.
- Campo desativado ganhou cinza mais forte e ícone de seta com opacidade reduzida.
- Rotação da seta foi bloqueada no estado desativado para reforçar ausência de interação.

## 29) Remoção do badge e reforço via contraste do campo

- Badge `Indisponível` removido por poluição visual.
- Estado desativado passou a depender apenas do próprio campo com maior contraste:
- fundo cinza sólido, texto/ícone mais apagados e leve redução de opacidade.

## 30) Reforço máximo do estado desativado + regra extra no período

- Contraste do estado desativado foi elevado para tons de cinza mais fortes em `campanhas` e `período`.
- Rótulos dos dois seletores também passam para cinza mais escuro quando desativados.
- `Período` agora desativa também quando não há `selectedCampaignId`, evitando aparência de ativo em estado vazio.

## 31) Padronização visual por referência de cinza

- Estado desativado dos seletores de `campanhas` e `período` ajustado para:
- fundo e borda `#e4e4e4`;
- texto e ícone `#aaaaaa`.

## 32) Ajuste de rótulos dos seletores desativados

- Os títulos `Campanhas ativas` e `Período` voltaram para a cor padrão (`viasoft`).
- Apenas o campo do seletor permanece em estilo desativado.

## 33) Reversão de rótulos para cinza no estado desativado

- Por decisão de usabilidade visual, os títulos `Campanhas ativas` e `Período` voltaram a acompanhar o estado desativado em cinza (`#aaaaaa`).

## 34) Alinhamento dos títulos dos seletores

- Títulos de `Vertical`, `Campanhas ativas` e `Período` foram centralizados em relação ao respectivo campo.

## 35) Reversão do alinhamento dos títulos dos seletores

- Centralização dos títulos foi revertida.
- Rótulos voltaram ao alinhamento original à esquerda.

## 36) Estabilização de layout com scrollbar

- Corrigido o deslocamento lateral dos cards ao alternar entre páginas com/sem rolagem.
- `html` passou a reservar espaço de scrollbar de forma estável:
- `overflow-y: scroll`
- `scrollbar-gutter: stable`

## 37) Estabilização do background entre estados com e sem rolagem

- O gradiente de fundo deixou de depender da altura do `body` (que varia conforme conteúdo).
- Background principal foi ancorado no `html` com `background-attachment: fixed`.
- Resultado esperado: mesmo visual de fundo ao alternar entre telas curtas e longas.

## 38) Hover sem deslocamento nos botões principais

- Classe utilitária `hover-lift` deixou de aplicar `translateY` no estado `:hover`.
- Mantido somente realce de sombra para feedback visual sem deslocar botões.

## 39) Feedback de carregamento no botão de PDF

- Botão `Gerar PDF` agora entra em estado de carregamento com ícone animado durante a geração.
- A animação encerra automaticamente ao detectar abertura do diálogo de salvar (`blur`), com fallback por timeout.
- Botão fica temporariamente desativado durante esse processo para evitar cliques repetidos.

## 40) Correção da animação do botão Gerar PDF

- Fluxo de geração do PDF foi ajustado para garantir render da animação antes do download iniciar.
- Estado de loading agora é aplicado com `flushSync` e o download é disparado após dois `requestAnimationFrame`.
- Removidos eventos que encerravam o loading cedo demais (`pagehide` e `beforeunload`), mantendo parada por `blur` + fallback de timeout.

## 41) Feedback textual no botão de PDF durante geração

- Botão principal agora troca o rótulo de `Gerar PDF` para `Gerando PDF...` enquanto o arquivo está sendo processado.
- Objetivo: reforçar o estado de progresso em conjunto com o spinner.

## 42) Feedback textual no botão de atualização

- Botão `Atualizar Dados` agora troca o rótulo para `Atualizando dados...` enquanto há atualização em andamento.
- O texto acompanha o mesmo estado já usado para a animação do ícone de refresh.

## 43) Largura fixa dos botões de ação no header

- Botões `Gerar PDF` e `Atualizar Dados` passaram a usar largura fixa (`w-[190px]`).
- Objetivo: evitar variação de tamanho quando o texto muda para estados de carregamento (`Gerando PDF...` / `Atualizando dados...`).

## 44) Exportação de PDF habilitada para vertical sem campanha ativa

- `/api/pdf` agora aceita `verticalTag` como alternativa ao `campaignId`.
- Quando não há campanha ativa na vertical selecionada, o botão `Gerar PDF` continua disponível e exporta o resumo de orçamento mensal da vertical.
- A página `/pdf` ganhou modo de renderização "somente orçamento da vertical" com paginação 1/1.

## 45) Correção de encoding no endpoint de PDF

- Erro de build no Turbopack foi causado por `app/api/pdf/route.ts` salvo em encoding não UTF-8.
- Arquivo foi convertido para UTF-8, eliminando a falha `invalid utf-8 sequence`.

## 46) PDF de vertical sem campanha ajustado para caber em 1 página

- No modo de PDF sem campanha ativa, o layout foi compactado para evitar quebra indevida em 2 páginas.
- Removido bloco de aviso redundante nesse modo e reduzido espaçamento/padding da seção principal.
- `min-h-screen` foi removido do `<main>` da página de PDF para evitar altura extra no contexto de impressão.

## 47) Otimização de tempo na geração de PDF (reuso de browser)

- A geração de PDF passou a reutilizar uma instância compartilhada de browser (`puppeteer`) por processo.
- Antes: cada exportação abria e fechava o Chrome inteiro.
- Agora: cada exportação abre/fecha apenas uma nova aba, reduzindo latência média por requisição.
