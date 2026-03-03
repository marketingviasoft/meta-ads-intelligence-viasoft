import { DashboardReport } from "@/components/dashboard-report";
import { PdfReadyFlag } from "@/components/pdf-ready-flag";
import { getActiveCampaigns, getDashboardPayload } from "@/lib/meta-dashboard";
import { PDF_PAGE_MIN_HEIGHT_PX, PDF_PAGE_WIDTH_PX } from "@/pdf/print-config";
import { parseRangeDays } from "@/utils/date-range";
import { formatDateLongBR } from "@/utils/formatters";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PdfPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const campaignFromQuery = Array.isArray(params.campaignId)
    ? params.campaignId[0]
    : params.campaignId;
  const rangeFromQuery = Array.isArray(params.rangeDays) ? params.rangeDays[0] : params.rangeDays;
  const rangeDays = parseRangeDays(rangeFromQuery);

  const campaigns = await getActiveCampaigns(false);
  const campaignId = campaignFromQuery ?? campaigns[0]?.id;

  if (!campaignId) {
    return (
      <main className="mx-auto mt-6 max-w-3xl rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        Nenhuma campanha ACTIVE foi encontrada para renderizar o PDF.
      </main>
    );
  }

  const payload = await getDashboardPayload({
    campaignId,
    rangeDays
  });

  return (
    <main className="min-h-screen bg-white py-3 print:py-0">
      <PdfReadyFlag />
      <section
        className="pdf-shell mx-auto px-7 py-6 print:px-0 print:py-0"
        style={{
          width: `${PDF_PAGE_WIDTH_PX}px`,
          minHeight: `${PDF_PAGE_MIN_HEIGHT_PX}px`
        }}
      >
        <header className="pdf-block mb-5 border-b border-slate-200 pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald">Meta Ads PDF Report</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">Dashboard de Performance</h1>
          <p className="mt-1 text-sm text-slate-600">
            Atual: {formatDateLongBR(payload.range.since)} ate {formatDateLongBR(payload.range.until)} | Anterior: {" "}
            {formatDateLongBR(payload.range.previousSince)} ate {formatDateLongBR(payload.range.previousUntil)}
          </p>
        </header>
        <DashboardReport data={payload} isPdf />
      </section>
    </main>
  );
}
