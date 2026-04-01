# Resumo Executivo

## Visão geral
`Meta Ads Intelligence | VIASOFT` é um dashboard corporativo para leitura, comparação e exportação de relatórios de campanhas Meta Ads por vertical de negócio.

Hoje a aplicação está em arquitetura `Supabase-first`:
- o dashboard e as rotas analíticas leem prioritariamente do Supabase;
- a Meta Graph API ficou concentrada no cron de sincronização e em poucos fluxos de preview/enriquecimento;
- o objetivo operacional é reduzir latência, evitar 502/timeout e manter leitura estável para marketing e gestão.

## O que o produto faz hoje
- Oferece Dashboard Gerencial consolidado (Visão Executiva) com leitura macro, filtros interativos na própria tela, rankings, distribuições e insights da carteira.
- Lista campanhas por vertical com catálogo ampliado, não restrito a campanhas ativas.
- Permite filtrar por:
  - `Vertical`
  - `Veiculação`
  - `Campanha`
  - `Período`
- Exibe budget mensal por vertical com:
  - investimento acumulado no ciclo Meta;
  - saldo disponível;
  - valor aplicado em campanhas;
  - imposto Meta;
  - barra de progresso do teto.
- Mostra métricas principais da campanha.
- Mostra estrutura hierárquica:
  - conjuntos de anúncios;
  - anúncios;
  - miniaturas de criativos;
  - preview do anúncio.
- Permite comparativos opcionais entre:
  - 2 conjuntos de anúncios;
  - 2 anúncios.
- Exporta PDF executivo com paginação por blocos funcionais.

## Regras críticas de negócio

### Performance
- O dia atual é excluído das métricas de performance.
- O comparativo usa sempre o período anterior equivalente.
- Dashboard e PDF devem manter paridade de leitura.

### Budget por vertical
- Ciclo Meta considerado: `24` do mês anterior até `23` do mês atual.
- O card de budget considera o acumulado até o dia atual como parcial.
- Imposto Meta considerado no demonstrativo: `12,15%`.
- Teto padrão total por vertical: `R$ 600,00`.
- Exceção:
  - `VIASOFT` -> teto total `R$ 1.000,00`.

### Catálogo e filtro de campanhas
- O catálogo não é mais apenas de campanhas ativas.
- Existe lookback de `180 dias`.
- A UI usa agrupamentos amigáveis de veiculação:
  - `Todos os status`
  - `Ativas`
  - `Pausadas`
  - `Com problemas`
  - `Em análise`
  - `Arquivadas`

### Verticais
- Opção padrão do seletor: `Todas as verticais`.
- Valor técnico: `__ALL_VERTICALS__`.
- Campanhas fora do padrão continuam visíveis apenas em `Todas as verticais`.

## Arquitetura atual

### Leitura principal
Camada principal:
- `lib/meta-insights-store.ts`

Rotas analíticas apoiadas no Supabase:
- `app/api/meta/campaigns/route.ts`
- `app/api/meta/performance/route.ts`
- `app/api/meta/vertical-budget/route.ts`
- `app/api/meta/adsets/route.ts`
- `app/api/meta/ads/route.ts`
- `app/api/meta/compare/route.ts`

### Sincronização
Cron principal:
- `app/api/cron/sync-meta/route.js`

Responsabilidades:
- buscar insights assíncronos da Meta;
- normalizar dados;
- persistir no Supabase;
- enriquecer estrutura de campanhas, grupos e anúncios.

### PDF
Arquivos centrais:
- `app/api/pdf/route.ts`
- `app/pdf/page.tsx`
- `lib/pdf-generator.ts`

Fluxo atual esperado:
1. Cabeçalho + seletores + budget
2. Comparativos, se houver seleção válida
3. Cards de métricas
4. Tendência consolidada + performance diária
5. Insights automáticos + recomendações

Também existe fluxo compacto de PDF apenas para vertical quando a requisição chega sem `campaignId` e com `verticalTag`.

## Estado atual de confiabilidade

### Pontos fortes
- Leitura do dashboard desacoplada da Meta no carregamento principal.
- Estrutura, campanhas, comparativos e budget já apoiados em Supabase.
- Cron assíncrono reduz risco de timeout e erro 502.
- Documentação de handoff, regras e runbook já está consistente com a arquitetura atual.

### Pontos de atenção
- A paginação do PDF é dinâmica e depende do fluxo real de renderização em `app/pdf/page.tsx`.
- Fluxos de preview de anúncio e enriquecimento ainda dependem da disponibilidade e permissões da Meta.
- Sempre que houver mudanças em regras de status, budget ou PDF, a pasta `docs` precisa ser revisada para não perder alinhamento.

## Riscos atuais
- Divergência futura entre paginação real do PDF e a constante legada, se alguém voltar a tratá-la como fonte de verdade.
- Regressões em preview/enriquecimento de anúncio por limites ou permissões da Meta.
- Drift entre cron, schema SQL e leitura do `meta-insights-store.ts` se o modelo de dados mudar sem atualização coordenada.

## Próximos passos prioritários
1. Manter a paginação do PDF sempre derivada do fluxo real de renderização, principalmente quando houver páginas condicionais.
2. Manter a validação de paridade entre dashboard e PDF sempre que novos blocos forem adicionados.
3. Revisar periodicamente os fluxos de preview e enriquecimento de criativo/destino, porque são os pontos ainda mais sensíveis à Meta.

## Conclusão
O produto está em um estágio sólido: a arquitetura já suporta operação estável, leitura executiva e relatórios com menor dependência de chamadas online durante a navegação.

O principal avanço desde a fase inicial foi a consolidação de uma arquitetura `Supabase-first`, com cron assíncrono, comparativos estruturais, regras formais de budget por vertical e PDF executivo aderente ao fluxo do dashboard.
