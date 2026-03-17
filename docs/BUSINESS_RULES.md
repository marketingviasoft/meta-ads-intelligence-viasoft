# Regras de negocio

## 1. Nome do produto
Nome oficial: `Meta Ads Intelligence | VIASOFT`

## 2. Regra de leitura de performance
- O dashboard exclui o dia atual das metricas de performance.
- O comparativo sempre usa periodo anterior equivalente.
- O PDF segue a mesma regra das metricas do dashboard.

## 3. Regra de budget mensal por vertical
### Ciclo de faturamento Meta
- O ciclo considerado para budget e fixo: dia 24 do mes anterior ate dia 23 do mes atual.
- O card de budget considera o acumulado ate o dia atual como parcial.

### Imposto
- Imposto Meta considerado no demonstrativo: `12,15%`.

### Tetos
- Tetos padrao:
  - valor base sem imposto: `R$ 535,00`
  - valor total com imposto: `R$ 600,00`
- Excecao:
  - vertical `VIASOFT` -> teto total com imposto: `R$ 1.000,00`

### Exibicao no dashboard
O card de budget mostra:
- total do ciclo com imposto;
- saldo disponivel no mes;
- valor aplicado em campanhas;
- imposto calculado;
- barra de progresso do valor investido e do total com imposto.

Se a vertical selecionada for `Todas as verticais`:
- o sistema nao soma tudo em um unico budget;
- a UI pede para o usuario selecionar uma vertical especifica.

## 4. Regra de catalogo de campanhas
O catalogo de campanhas nao e mais restrito a campanhas ativas.

Podem aparecer campanhas:
- em veiculacao;
- pausadas;
- com problemas;
- em analise;
- arquivadas;
- sem entrega recente;
- historicas dentro da janela de lookback.

Lookback atual do catalogo:
- `180 dias`

## 5. Regra de vertical
- Opcao padrao do seletor: `Todas as verticais`
- Valor tecnico: `__ALL_VERTICALS__`
- Verticais reconhecidas hoje:
  - VIASOFT
  - Agrotitan
  - Construshow
  - Filt
  - Petroshow
  - Voors
- Campanhas fora do padrao de nome continuam visiveis apenas em `Todas as verticais`.

## 6. Regra de veiculacao/status
A aplicacao trabalha com agrupamentos amigaveis para o usuario.

Agrupamentos atuais:
- Todos os status
- Ativas
- Pausadas
- Com problemas
- Em analise
- Arquivadas

Importante:
- a classificacao exibida ao usuario e normalizada pela aplicacao;
- o badge visivel no cabecalho da campanha tambem segue essa normalizacao.

## 7. Regra de KPI principal
A familia de metricas e padronizada e o KPI principal varia conforme o objetivo.

Metricas base:
- Valor investido
- Visualizacoes do anuncio
- Cliques no anuncio
- Taxa de cliques
- Custo por clique
- Resultados da campanha

KPI principal por objetivo:
- TRAFFIC -> clicks
- RECOGNITION -> impressions
- ENGAGEMENT -> results
- CONVERSIONS -> results

## 8. Regra de estrutura da campanha
A estrutura da campanha deve mostrar:
- grupos de anuncios da campanha selecionada;
- anuncios do grupo selecionado;
- miniatura do criativo quando existir;
- nome do criativo quando existir;
- URL/destino quando existir;
- comparacao opcional entre 2 grupos e/ou 2 anuncios.

## 9. Regra de comparativos
- O usuario pode selecionar no maximo 2 grupos e 2 anuncios.
- Os comparativos aparecem somente quando houver exatamente 2 itens validos selecionados.
- As comparacoes usam a mesma familia de metricas do dashboard principal.
- Nao ha bloco textual do tipo A-B; a comparacao e direta por valor.

## 10. Regra do PDF
### Fluxo por campanha
1. Header + seletores + budget
2. Comparativos (condicional)
3. Cards de metricas
4. Tendencia consolidada + performance diaria
5. Insights + recomendacoes

### Fluxo por vertical
- se a requisicao vier apenas com `verticalTag`, gera PDF compacto de budget da vertical.

## 11. Regra de origem de dados
### Supabase-first
As rotas abaixo devem continuar lendo do Supabase:
- campaigns
- performance
- vertical-budget
- adsets
- ads
- compare

### Meta direta apenas quando necessario
As rotas de preview/enriquecimento ainda podem falar com a Meta:
- ad-preview
- ad-analytics
- cron sync

## 12. Regra de seguranca
- nunca expor token da Meta no frontend;
- variaveis sensiveis devem continuar server-side;
- cron pode ser protegido por `CRON_SECRET`.
