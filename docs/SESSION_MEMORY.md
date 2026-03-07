# Memória de Sessão (Linha do Tempo)

Este arquivo registra as decisões e mudanças relevantes já feitas no projeto.

## 0) Princípios definidos

- Produto executivo para analistas, gerentes e diretores.
- Linguagem clara para não especialistas.
- Meta API é a verdade.
- Sem banco e sem auth no MVP.
- PDF obrigatório via backend e rota `/pdf`.

## 1) Base técnica e estabilização inicial

- Projeto estruturado com:
  - `app`, `components`, `lib`, `services`, `utils`, `pdf`, `api`.
- Correções de tipagem para Next (App Router) e remoção de retornos `JSX.Element` que quebravam build.
- Typecheck e build estabilizados.

## 2) Integração com Meta API

- Endpoints internos padronizados:
  - campanhas, performance, adsets, ads, ad-preview, cache invalidate.
- Validação de env em todos endpoints meta.
- Tratamento de erro explícito para UI (mensagem detalhada por endpoint).
- `requestJson` ajustado para ler body uma única vez e suportar JSON/texto em erro.

## 3) Regras de seleção e estrutura

- Campanhas no dropdown:
  - somente ativas + com veiculação ativa.
- Estrutura de campanha adicionada:
  - grupos de anúncios ativos
  - anúncios ativos do grupo
  - miniatura
  - destino
  - preview avançado em modal

## 4) Insights e tendência

- `utils/insights-engine.ts` preservado como motor central.
- Semáforo executivo incorporado em Tendência:
  - Manter / Revisar / Intervir.
- Mensageria refinada para tom institucional executivo.

## 5) Branding

- Nome oficial:
  - `Meta Ads Intelligence | VIASOFT`.
- Padronização em título, metadata, assinatura de PDF e nome do arquivo exportado.
- Distinção de assets:
  - `public/logos/*` para branding
  - `public/icons/verticais/*` para verticais.

## 6) Verticais e ícones

- Parse da vertical a partir de nome de campanha:
  - formato `[Agência] [Vertical] [Objetivo] ...`
- Campanhas fora do padrão:
  - marcadas como `Sem vertical`
  - visíveis apenas quando filtro = `Todas as verticais`.
- Ícones por vertical usando `utils/vertical-ui.ts`.

## 7) PDF e paginação

- Migração para `puppeteer-core` + `@sparticuz/chromium` (Vercel/serverless).
- PDF em paisagem com layout modular por página.
- Configuração atual:
  - `PDF_TOTAL_PAGES = 5`.
- Organização atual:
  1. Capa executiva + seletores + orçamento
  2. Informações + estrutura de campanha
  3. Cards de métricas
  4. Tendência + gráfico
  5. Insights + recomendações
- Rodapé padronizado com assinatura institucional e data/hora BR.

## 8) Ajustes visuais realizados

- Padronização de cards:
  - sombras suaves
  - raio uniforme
  - sem hover desnecessário
- Botões com hierarquia clara
- Melhorias de responsividade mobile
- Gráfico:
  - melhor uso de espaço
  - tooltip revisado
  - tratamento de ticks em telas pequenas
  - legenda reposicionada em PDF

## 9) Cache e contingência

- TTL 5 minutos.
- Stale fallback de 15 minutos.
- Sinalização visual de contingência quando snapshot fica mais antigo que TTL.
- Invalidação manual por escopo via endpoint dedicado.

## 10) Orçamento por vertical (mudança mais recente)

- Ciclo Meta fixado em:
  - 24 (início) até 23 (fim).
- Cálculo usa dados até ontem (sem dia atual), respeitando limite do ciclo.
- Teto base alterado para `R$ 535`.
- Imposto de `12,15%` aplicado no demonstrativo.
- Card de orçamento mostra:
  - investimento
  - imposto
  - total
  - saldo/excedente
  - barra dupla (investido e investido+imposto)

## 11) Itens que merecem nova rodada de melhoria

1. Destino de anúncios ainda pode falhar em alguns criativos (`Site configurado na Meta Ads (URL não exposta pela API)`) por limitação/variação de payload Meta.
   - Foi adicionado diagnóstico opcional de origem via `META_DESTINATION_DIAGNOSTIC_LOG=1` para mapear ausência de campos sem expor token.
2. PDF é sensível a mudanças de copy/padding:
   - qualquer alteração em cards da página 4 pode impactar quebra/rodapé.
3. Recomenda-se manter rotina de validação manual antes de release:
   - 2 previews avançados
   - PDF completo
   - filtro ativo com veiculação real
   - orçamento por vertical.

## 12) Protocolo de retomada em casa

1. Pull da branch.
2. Ler `docs/HANDOFF.md` + `docs/BUSINESS_RULES.md`.
3. Rodar `npm install`, `npm run typecheck`, `npm run dev`.
4. Continuar pelo topo da seção “itens que merecem nova rodada”.

## 13) Ajustes recentes de continuidade

- `utils/date-range.ts` passou a calcular o range de performance com base em `APP_TIMEZONE` (default `America/Sao_Paulo`), mantendo a regra de nunca incluir o dia atual mesmo em runtime UTC.
- `services/meta-api.ts` ganhou logging controlado para diagnóstico de destino de anúncio sem URL útil (`META_DESTINATION_DIAGNOSTIC_LOG=1`), registrando somente sinais e presença de campos.
