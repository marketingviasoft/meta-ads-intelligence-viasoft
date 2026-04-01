import { Activity, AlertTriangle, CheckCircle2, Clock3, DatabaseZap, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { getRecentMetaSyncLogs, type MetaSyncLogRow } from "@/lib/meta-sync-logs-store";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null): string {
  if (!value) {
    return "n/a";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function formatRange(log: MetaSyncLogRow): string {
  if (!log.range_since || !log.range_until) {
    return "n/a";
  }

  return `${log.range_since} -> ${log.range_until}`;
}

function formatDuration(executionMs: number | null): string {
  if (!executionMs || executionMs <= 0) {
    return "n/a";
  }

  if (executionMs < 1000) {
    return `${executionMs} ms`;
  }

  const seconds = executionMs / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function getStatusTone(status: string): string {
  const normalized = status.toUpperCase();

  if (normalized === "SUCCESS") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (normalized === "RUNNING") {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }

  return "border-rose-200 bg-rose-50 text-rose-800";
}

function SummaryCard({
  title,
  value,
  detail,
  icon
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <article className="surface-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
          <p className="mt-1 text-sm text-slate-500">{detail}</p>
        </div>
        <span className="inline-flex size-10 items-center justify-center rounded-xl bg-viasoft/10 text-viasoft">
          {icon}
        </span>
      </div>
    </article>
  );
}

export default async function SyncLogsPage() {
  const { available, logs, errorMessage } = await getRecentMetaSyncLogs(20);
  const latestLog = logs[0] ?? null;
  const latestSuccess = logs.find((log) => log.status === "SUCCESS") ?? null;
  const failedLogs = logs.filter((log) => log.status.startsWith("ERROR"));
  const successRate = logs.length > 0 ? Math.round(((logs.length - failedLogs.length) / logs.length) * 100) : 0;

  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 pb-12 sm:px-6 lg:px-8">
      <section className="surface-panel mb-5 overflow-hidden p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-viasoft/20 bg-viasoft/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-viasoft">
              <DatabaseZap size={14} />
              Observabilidade interna
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-viasoft">Histórico de sincronizações da Meta</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Leitura operacional do `meta_sync_logs` para acompanhar status, duração, range sincronizado e falhas recentes sem depender do console da Vercel.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-700">Atualização da página</p>
            <p className="mt-1">Renderização server-side em tempo real com `force-dynamic`.</p>
          </div>
        </div>
      </section>

      {!available ? (
        <section className="surface-panel rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Observabilidade indisponível neste ambiente</p>
              <p className="mt-1">{errorMessage}</p>
            </div>
          </div>
        </section>
      ) : null}

      {available ? (
        <>
          <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Última execução"
              value={latestLog ? latestLog.status : "Sem histórico"}
              detail={latestLog ? formatDateTime(latestLog.started_at) : "Nenhum registro encontrado"}
              icon={<RefreshCw size={18} />}
            />
            <SummaryCard
              title="Último sucesso"
              value={latestSuccess ? formatDuration(latestSuccess.execution_ms) : "n/a"}
              detail={latestSuccess ? formatDateTime(latestSuccess.completed_at) : "Nenhuma execução com sucesso"}
              icon={<CheckCircle2 size={18} />}
            />
            <SummaryCard
              title="Falhas recentes"
              value={String(failedLogs.length)}
              detail={logs.length > 0 ? `Base considerada: ${logs.length} execuções` : "Sem execuções recentes"}
              icon={<AlertTriangle size={18} />}
            />
            <SummaryCard
              title="Taxa de sucesso"
              value={`${successRate}%`}
              detail={latestLog ? `Range mais recente: ${formatRange(latestLog)}` : "Sem range disponível"}
              icon={<Activity size={18} />}
            />
          </section>

          <section className="surface-panel overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-viasoft">Execuções recentes</h2>
              <p className="mt-1 text-sm text-slate-500">
                Status, duração, volume sincronizado e eventuais erros da trilha operacional mais recente.
              </p>
            </div>

            {logs.length === 0 ? (
              <div className="px-5 py-8 text-sm text-slate-500">Nenhuma sincronização registrada até o momento.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Início</th>
                      <th className="px-5 py-3">Fim</th>
                      <th className="px-5 py-3">Duração</th>
                      <th className="px-5 py-3">Range</th>
                      <th className="px-5 py-3">Volumes</th>
                      <th className="px-5 py-3">Versão</th>
                      <th className="px-5 py-3">Erro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white align-top">
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusTone(log.status)}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-700">{formatDateTime(log.started_at)}</td>
                        <td className="px-5 py-4 text-slate-700">{formatDateTime(log.completed_at)}</td>
                        <td className="px-5 py-4 text-slate-700">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 size={14} className="text-slate-400" />
                            {formatDuration(log.execution_ms)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-700">{formatRange(log)}</td>
                        <td className="px-5 py-4 text-slate-700">
                          <div>Insights: {log.synced_insights ?? 0}</div>
                          <div>Adsets: {log.synced_adsets ?? 0}</div>
                          <div>Ads: {log.synced_ads ?? 0}</div>
                          <div>Rows lidas: {log.fetched_rows ?? 0}</div>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-slate-600">
                          {log.sync_version ?? "n/a"}
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {log.error_message ? (
                            <div className="max-w-md rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-900">
                              {log.error_message}
                            </div>
                          ) : (
                            <span className="text-slate-400">Sem erro</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
