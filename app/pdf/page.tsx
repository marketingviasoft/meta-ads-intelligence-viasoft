import { CampaignHeaderCard, DashboardReport } from "@/components/dashboard-report";
import { PdfReadyFlag } from "@/components/pdf-ready-flag";
import { getActiveCampaigns, getAdSetAds, getCampaignAdSets, getDashboardPayload } from "@/lib/meta-dashboard";
import { PDF_PAGE_WIDTH_PX } from "@/pdf/print-config";
import { parseRangeDays } from "@/utils/date-range";

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
  const adSets = await getCampaignAdSets(campaignId, false);
  const selectedAdSetId = adSets[0]?.id ?? "";
  const ads = selectedAdSetId ? await getAdSetAds(selectedAdSetId, false) : [];
  const selectedAdSetName = adSets[0]?.name ?? "";

  return (
    <main className="min-h-screen bg-white py-3 print:py-0">
      <PdfReadyFlag />
      <section
        className="pdf-shell mx-auto px-7 py-6 print:px-0 print:py-0"
        style={{
          width: `${PDF_PAGE_WIDTH_PX}px`
        }}
      >
        <div className="space-y-4">
          <CampaignHeaderCard campaign={payload.campaign} range={payload.range} isPdf />

          <section className="surface-panel pdf-block p-4">
            <h2 className="text-base font-semibold text-viasoft">Estrutura da campanha</h2>
            <p className="mt-1 text-sm text-slate-600">
              Grupos de anúncios e anúncios ativos no momento da geração do relatório.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-viasoft">
                  Grupos de anúncios
                </p>
                {adSets.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Nenhum grupo ativo encontrado.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {adSets.slice(0, 8).map((adSet) => (
                      <li key={adSet.id} className="rounded-md border border-slate-200 px-2 py-1">
                        {adSet.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-viasoft">
                  Anúncios ({selectedAdSetName || "grupo não selecionado"})
                </p>
                {ads.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Nenhum anúncio ativo encontrado.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {ads.slice(0, 8).map((ad) => (
                      <li key={ad.id} className="rounded-md border border-slate-200 px-2 py-1">
                        {ad.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          <DashboardReport data={payload} isPdf hideCampaignHeader />
        </div>
      </section>
    </main>
  );
}
