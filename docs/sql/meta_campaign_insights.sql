-- Recomendado executar no SQL Editor do Supabase.
-- Dependencia para UUID aleatorio.
create extension if not exists pgcrypto;

-- Fato diario de performance no nivel mais granular disponivel para o produto:
-- campanha + grupo de anuncios + anuncio.
create table if not exists public.meta_campaign_insights (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  date_stop date,
  campaign_id text not null,
  campaign_name text not null,
  adset_id text not null default '',
  adset_name text,
  ad_id text not null default '',
  ad_name text,
  objective text,
  effective_status text,
  configured_status text,
  delivery_status text,
  spend numeric(14,2) not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  reach bigint not null default 0,
  frequency numeric(12,6) not null default 0,
  ctr numeric(12,6) not null default 0,
  cpc numeric(14,6) not null default 0,
  cpm numeric(14,6) not null default 0,
  cpp numeric(14,6) not null default 0,
  unique_clicks bigint not null default 0,
  inline_link_clicks bigint not null default 0,
  outbound_clicks bigint not null default 0,
  conversions numeric(14,4) not null default 0,
  purchases numeric(14,4) not null default 0,
  leads numeric(14,4) not null default 0,
  link_clicks numeric(14,4) not null default 0,
  post_engagement numeric(14,4) not null default 0,
  cost_per_result numeric(14,6),
  quality_ranking text,
  engagement_rate_ranking text,
  conversion_rate_ranking text,
  actions jsonb not null default '{}'::jsonb,
  cost_per_action_type jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migracao incremental para tabelas ja existentes (backward-compatible).
alter table public.meta_campaign_insights add column if not exists objective text;
alter table public.meta_campaign_insights add column if not exists date_stop date;
alter table public.meta_campaign_insights add column if not exists adset_id text default '';
alter table public.meta_campaign_insights add column if not exists adset_name text;
alter table public.meta_campaign_insights add column if not exists ad_id text default '';
alter table public.meta_campaign_insights add column if not exists ad_name text;
alter table public.meta_campaign_insights add column if not exists effective_status text;
alter table public.meta_campaign_insights add column if not exists configured_status text;
alter table public.meta_campaign_insights add column if not exists delivery_status text;
alter table public.meta_campaign_insights add column if not exists reach bigint not null default 0;
alter table public.meta_campaign_insights add column if not exists frequency numeric(12,6) not null default 0;
alter table public.meta_campaign_insights add column if not exists ctr numeric(12,6) not null default 0;
alter table public.meta_campaign_insights add column if not exists cpc numeric(14,6) not null default 0;
alter table public.meta_campaign_insights add column if not exists cpm numeric(14,6) not null default 0;
alter table public.meta_campaign_insights add column if not exists cpp numeric(14,6) not null default 0;
alter table public.meta_campaign_insights add column if not exists unique_clicks bigint not null default 0;
alter table public.meta_campaign_insights add column if not exists inline_link_clicks bigint not null default 0;
alter table public.meta_campaign_insights add column if not exists outbound_clicks bigint not null default 0;
alter table public.meta_campaign_insights add column if not exists conversions numeric(14,4) not null default 0;
alter table public.meta_campaign_insights add column if not exists leads numeric(14,4) not null default 0;
alter table public.meta_campaign_insights add column if not exists link_clicks numeric(14,4) not null default 0;
alter table public.meta_campaign_insights add column if not exists post_engagement numeric(14,4) not null default 0;
alter table public.meta_campaign_insights add column if not exists cost_per_result numeric(14,6);
alter table public.meta_campaign_insights add column if not exists quality_ranking text;
alter table public.meta_campaign_insights add column if not exists engagement_rate_ranking text;
alter table public.meta_campaign_insights add column if not exists conversion_rate_ranking text;
alter table public.meta_campaign_insights add column if not exists actions jsonb not null default '{}'::jsonb;
alter table public.meta_campaign_insights add column if not exists cost_per_action_type jsonb not null default '{}'::jsonb;
alter table public.meta_campaign_insights add column if not exists updated_at timestamptz not null default now();
update public.meta_campaign_insights set adset_id = '' where adset_id is null;
update public.meta_campaign_insights set ad_id = '' where ad_id is null;
alter table public.meta_campaign_insights alter column adset_id set not null;
alter table public.meta_campaign_insights alter column ad_id set not null;

-- Evita duplicacao no upsert do cron.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'meta_campaign_insights_date_campaign_adset_ad_key'
  ) then
    alter table public.meta_campaign_insights
      drop constraint if exists meta_campaign_insights_date_campaign_id_key;

    alter table public.meta_campaign_insights
      add constraint meta_campaign_insights_date_campaign_adset_ad_key
      unique (date, campaign_id, adset_id, ad_id);
  end if;
end $$;

create index if not exists idx_meta_campaign_insights_date
  on public.meta_campaign_insights (date desc);

create index if not exists idx_meta_campaign_insights_campaign_id
  on public.meta_campaign_insights (campaign_id);

create index if not exists idx_meta_campaign_insights_campaign_date
  on public.meta_campaign_insights (campaign_id, date desc);

create index if not exists idx_meta_campaign_insights_adset_date
  on public.meta_campaign_insights (adset_id, date desc);

create index if not exists idx_meta_campaign_insights_ad_date
  on public.meta_campaign_insights (ad_id, date desc);

-- Dimensao de grupos de anuncios.
create table if not exists public.meta_adsets (
  id text primary key,
  campaign_id text not null,
  name text not null,
  status text not null default 'UNKNOWN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_meta_adsets_campaign_id
  on public.meta_adsets (campaign_id);

-- Dimensao de anuncios.
create table if not exists public.meta_ads (
  id text primary key,
  adset_id text not null references public.meta_adsets(id) on delete cascade,
  campaign_id text not null,
  name text not null,
  status text not null default 'UNKNOWN',
  creative_name text,
  creative_thumb text,
  creative_link text,
  demographics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meta_ads add column if not exists demographics jsonb not null default '{}'::jsonb;
alter table public.meta_ads add column if not exists creative_name text;
update public.meta_ads
set creative_name = name
where (creative_name is null or btrim(creative_name) = '')
  and name is not null;

create index if not exists idx_meta_ads_adset_id
  on public.meta_ads (adset_id);

create index if not exists idx_meta_ads_campaign_id
  on public.meta_ads (campaign_id);

-- Comentarios para governanca de dados.
comment on table public.meta_campaign_insights is
  'Historico diario de performance da Meta Ads no nivel de anuncio, com chaves de campanha, grupo e anuncio.';

comment on column public.meta_campaign_insights.date is
  'Data do insight diario (date_start da Meta).';
comment on column public.meta_campaign_insights.date_stop is
  'Data final do insight (date_stop da Meta). Em time_increment=1 normalmente coincide com a data.';
comment on column public.meta_campaign_insights.campaign_id is
  'ID unico da campanha na Meta Ads.';
comment on column public.meta_campaign_insights.campaign_name is
  'Nome da campanha na data da coleta.';
comment on column public.meta_campaign_insights.adset_id is
  'ID do grupo de anuncios associado a linha de performance.';
comment on column public.meta_campaign_insights.adset_name is
  'Nome do grupo de anuncios na data da coleta.';
comment on column public.meta_campaign_insights.ad_id is
  'ID do anuncio associado a linha de performance.';
comment on column public.meta_campaign_insights.ad_name is
  'Nome do anuncio na data da coleta.';
comment on column public.meta_campaign_insights.objective is
  'Objetivo da campanha quando informado pela Meta.';
comment on column public.meta_campaign_insights.effective_status is
  'Status efetivo retornado pela Meta.';
comment on column public.meta_campaign_insights.configured_status is
  'Status configurado da campanha na Meta.';
comment on column public.meta_campaign_insights.delivery_status is
  'Classificacao de entrega normalizada pelo backend.';
comment on column public.meta_campaign_insights.spend is
  'Valor investido no dia.';
comment on column public.meta_campaign_insights.impressions is
  'Impressoes do dia.';
comment on column public.meta_campaign_insights.clicks is
  'Cliques do dia.';
comment on column public.meta_campaign_insights.reach is
  'Pessoas unicas alcancadas no dia.';
comment on column public.meta_campaign_insights.frequency is
  'Frequencia media de exposicao (impressions / reach).';
comment on column public.meta_campaign_insights.ctr is
  'Taxa de cliques percentual do dia.';
comment on column public.meta_campaign_insights.cpc is
  'Custo medio por clique.';
comment on column public.meta_campaign_insights.cpm is
  'Custo por mil impressoes.';
comment on column public.meta_campaign_insights.cpp is
  'Custo por mil pessoas alcancadas.';
comment on column public.meta_campaign_insights.unique_clicks is
  'Cliques unicos do dia.';
comment on column public.meta_campaign_insights.inline_link_clicks is
  'Cliques inline extraidos de actions.';
comment on column public.meta_campaign_insights.outbound_clicks is
  'Cliques de saida extraidos de actions.';
comment on column public.meta_campaign_insights.conversions is
  'Conversoes agregadas retornadas pela Meta.';
comment on column public.meta_campaign_insights.purchases is
  'Compras identificadas em actions.';
comment on column public.meta_campaign_insights.leads is
  'Leads identificados em actions.';
comment on column public.meta_campaign_insights.link_clicks is
  'Resultado de trafego usado pelo dashboard.';
comment on column public.meta_campaign_insights.post_engagement is
  'Resultado de engajamento usado pelo dashboard.';
comment on column public.meta_campaign_insights.cost_per_result is
  'Custo por resultado principal calculado no backend.';
comment on column public.meta_campaign_insights.quality_ranking is
  'Ranking de qualidade do anuncio.';
comment on column public.meta_campaign_insights.engagement_rate_ranking is
  'Ranking de taxa de engajamento do anuncio.';
comment on column public.meta_campaign_insights.conversion_rate_ranking is
  'Ranking de taxa de conversao do anuncio.';
comment on column public.meta_campaign_insights.actions is
  'Mapa bruto action_type -> value retornado pela Meta.';
comment on column public.meta_campaign_insights.cost_per_action_type is
  'Mapa bruto action_type -> cost retornado pela Meta.';
comment on column public.meta_campaign_insights.created_at is
  'Timestamp de criacao da linha no warehouse.';
comment on column public.meta_campaign_insights.updated_at is
  'Timestamp de ultima atualizacao da linha no warehouse.';

comment on table public.meta_adsets is
  'Dimensao local de grupos de anuncios sincronizada para filtros, estrutura e comparativos.';

comment on column public.meta_adsets.id is
  'ID unico do grupo de anuncios.';
comment on column public.meta_adsets.campaign_id is
  'Campanha pai do grupo de anuncios.';
comment on column public.meta_adsets.name is
  'Nome do grupo de anuncios.';
comment on column public.meta_adsets.status is
  'Status normalizado do grupo de anuncios.';
comment on column public.meta_adsets.updated_at is
  'Data/hora da ultima sincronizacao do grupo.';

comment on table public.meta_ads is
  'Dimensao local de anuncios sincronizada para estrutura, preview e comparativos.';

comment on column public.meta_ads.id is
  'ID unico do anuncio.';
comment on column public.meta_ads.adset_id is
  'Grupo de anuncios pai.';
comment on column public.meta_ads.campaign_id is
  'Campanha pai do anuncio.';
comment on column public.meta_ads.name is
  'Nome do anuncio.';
comment on column public.meta_ads.status is
  'Status normalizado do anuncio.';
comment on column public.meta_ads.creative_name is
  'Nome do criativo associado quando disponivel.';
comment on column public.meta_ads.creative_thumb is
  'URL da miniatura do criativo quando disponivel.';
comment on column public.meta_ads.creative_link is
  'URL de destino principal do criativo quando disponivel.';
comment on column public.meta_ads.demographics is
  'Resumo opcional de demografia/perfil quando enriquecido.';
comment on column public.meta_ads.updated_at is
  'Data/hora da ultima sincronizacao do anuncio.';
