-- Script de migração para telemetria de sincronização da Meta (Cron Observability)
create table if not exists public.meta_sync_logs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null, -- 'SUCCESS', 'ERROR_RATE_LIMIT', 'ERROR_UNKNOWN', 'RUNNING'
  sync_version text,
  fetched_rows integer default 0,
  synced_insights integer default 0,
  synced_adsets integer default 0,
  synced_ads integer default 0,
  error_message text,
  error_stack text,
  range_since date,
  range_until date,
  execution_ms integer
);

create index if not exists idx_meta_sync_logs_started_at on public.meta_sync_logs(started_at desc);
create index if not exists idx_meta_sync_logs_status on public.meta_sync_logs(status);

comment on table public.meta_sync_logs is 'Tabela de logging persistente para jobs de sincronização da Meta, eliminando a dependência do console.log ingênuo da Vercel.';
