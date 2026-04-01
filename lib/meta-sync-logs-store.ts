import { supabase } from "@/lib/supabaseClient.js";

export type MetaSyncLogRow = {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  sync_version: string | null;
  fetched_rows: number | null;
  synced_insights: number | null;
  synced_adsets: number | null;
  synced_ads: number | null;
  error_message: string | null;
  range_since: string | null;
  range_until: string | null;
  execution_ms: number | null;
};

function isMissingSyncLogsTableMessage(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("meta_sync_logs") &&
    (normalized.includes("schema cache") ||
      normalized.includes("could not find the table") ||
      normalized.includes("does not exist") ||
      normalized.includes("relation"))
  );
}

export async function getRecentMetaSyncLogs(limit = 20): Promise<{
  available: boolean;
  logs: MetaSyncLogRow[];
  errorMessage: string | null;
}> {
  const { data, error } = await supabase
    .from("meta_sync_logs")
    .select(
      [
        "id",
        "started_at",
        "completed_at",
        "status",
        "sync_version",
        "fetched_rows",
        "synced_insights",
        "synced_adsets",
        "synced_ads",
        "error_message",
        "range_since",
        "range_until",
        "execution_ms"
      ].join(",")
    )
    .order("started_at", { ascending: false })
    .range(0, Math.max(limit - 1, 0));

  if (error) {
    const message = error.message ?? "Falha ao ler meta_sync_logs";

    if (isMissingSyncLogsTableMessage(message)) {
      return {
        available: false,
        logs: [],
        errorMessage:
          "A tabela meta_sync_logs ainda nao esta disponivel neste ambiente. Aplique docs/sql/meta_sync_logs.sql para habilitar esta visao."
      };
    }

    throw new Error(`Supabase: ${message}`);
  }

  return {
    available: true,
    logs: (data ?? []) as MetaSyncLogRow[],
    errorMessage: null
  };
}
