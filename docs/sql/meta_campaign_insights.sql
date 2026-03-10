-- Recomendado executar no SQL Editor do Supabase.
-- Dependência para UUID aleatório.
create extension if not exists pgcrypto;

create table if not exists public.meta_campaign_insights (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  campaign_id text not null,
  campaign_name text not null,
  spend numeric(14,2) not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  purchases numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

-- Evita duplicação no upsert do cron.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'meta_campaign_insights_date_campaign_id_key'
  ) then
    alter table public.meta_campaign_insights
      add constraint meta_campaign_insights_date_campaign_id_key
      unique (date, campaign_id);
  end if;
end $$;

create index if not exists idx_meta_campaign_insights_date
  on public.meta_campaign_insights (date desc);

create index if not exists idx_meta_campaign_insights_campaign_id
  on public.meta_campaign_insights (campaign_id);

