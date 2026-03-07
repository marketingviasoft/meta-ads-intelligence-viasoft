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
- Cálculo até ontem, sem dia atual.
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
