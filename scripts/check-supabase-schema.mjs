import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function parseEnvFile(filePath) {
  const env = {};
  const raw = fs.readFileSync(filePath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

async function main() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(".env.local não encontrado");
  }

  const env = parseEnvFile(envPath);
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Credenciais do Supabase ausentes em .env.local");
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const [objectiveCategorySample, objectiveCategoryCount, syncLogsProbe] = await Promise.all([
    supabase.from("meta_campaign_insights").select("objective_category").limit(1),
    supabase
      .from("meta_campaign_insights")
      .select("id", { head: true, count: "exact" })
      .not("objective_category", "is", null),
    supabase.from("meta_sync_logs").select("id").limit(1)
  ]);

  const report = {
    checkedAt: new Date().toISOString(),
    objective_category: {
      available: !objectiveCategorySample.error,
      populatedRows: objectiveCategoryCount.count ?? 0,
      error: objectiveCategorySample.error?.message ?? objectiveCategoryCount.error?.message ?? null
    },
    meta_sync_logs: {
      available: !syncLogsProbe.error,
      error: syncLogsProbe.error?.message ?? null
    }
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error ?? "erro desconhecido");
  console.error(JSON.stringify({ error: message }, null, 2));
  process.exit(1);
});
