# Memória Operacional de Retomada (Session Memory)

Este documento atua como memória viva de contexto para as IAs durante a retomada do projeto. Leia sempre este arquivo antes de modificar o código ou inferir status de funcionalidades cruciais.

## Onde Paramos (Março 2026)
Consolidamos as evoluções da visão executiva e estabelecemos firmemente o Supabase como nossa camada de leitura. Concluímos atualizações textuais diretas e criamos novos componentes de agregação do topo gerencial, além de aprofundar lógica em utilitários semânticos e preparar a categorização de objetivos via schema.

## O que foi implementado/consolidado
- **Visão Executiva Funcional e Madura**: A tela principal reflete um dashboard diretivo funcional.
- **KPIs do Topo Reformulados**: Foram adicionados tooltips descritivos nas métricas, inserimos o novo **KPI de Cliques**, e procedemos com a remoção de "Ações no Objetivo" para despoluir a visualização.
- **Top 3 Eficiências por Objetivo**: Institucionalizada a exibição via 4 categorias estritamente fixas: `Conversão`, `Engajamento`, `Tráfego`, e `Reconhecimento`.
- **Labels Amigáveis Compartilhados**: Unificamos dicionários em `utils/objective.ts` e `utils/labels.ts`.
- **Arquitetura Imponente**: A manutenção firme de uma arquitetura estrita e puramente Supabase-first no carregamento do dashboard.

## PENDÊNCIAS PARCIAIS (Não considere finalizadas!)
- A **cobertura de testes** é ainda preliminar.
- O **logging e monitoramento do cron** dependem de console.log simples e não estão amadurecidos.
- A **centralização total de constantes de negócio** ainda é incompleta, existindo lógicas soltas.
- **Migração do Schema (`objective_category`)**: Há dependência de ação/migração manual do sistema de banco, necessitando fortemente a preservação do status de **fallback** via regex. A tabela de ingestão ainda passa pela transição do campo explícito `objective_category`.

## O que NÃO deve ser quebrado
- O período atual (dia de hoje) **não faz parte** dos cálculos de performance, porém faz parte fracionado do orçamento vertical.
- O ciclo Meta flui invariavelmente do **dia 24 anterior ao 23 atual**.
- O imposto embutido Meta é de **12,15%**.
- A veracidade de filtros globais é ancorada puramente pela navegação baseada em URL (`verticalTag`, `deliveryGroup`, `rangeDays`).

## Próximos Passos Naturais
1. **Auditar Schema**: Avaliar concretamente a execução de `docs/sql/add_objective_category.sql` sobre o banco principal.
2. **Consolidação Técnica**: Fechar lacunas nas constantes de negócio espalhadas em scripts soltos/cron.
3. **Observabilidade Contínua**: Elevar métricas operacionais e tracking de erros na ingestão síncrona/cron da Vercel.
