import Link from "next/link";
import { ArrowRight, LayoutDashboard, LineChart, Target } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { PUBLICATION_NAME } from "@/lib/branding";
import {
  buildDashboardHref,
  type CampaignStatusFilterValue
} from "@/lib/dashboard-query";
import type { RangeDays } from "@/lib/types";

type ExecutiveDashboardClientProps = {
  initialVerticalTag: string | null;
  initialDeliveryGroup: CampaignStatusFilterValue;
  initialRangeDays: RangeDays;
};

function getDeliveryLabel(deliveryGroup: CampaignStatusFilterValue): string {
  switch (deliveryGroup) {
    case "ACTIVE":
      return "Ativas";
    case "PAUSED":
      return "Pausadas";
    case "WITH_ISSUES":
      return "Com problemas";
    case "PENDING_REVIEW":
      return "Em análise";
    case "ARCHIVED":
      return "Arquivadas";
    default:
      return "Todos os status";
  }
}

export function ExecutiveDashboardClient({
  initialVerticalTag,
  initialDeliveryGroup,
  initialRangeDays
}: ExecutiveDashboardClientProps) {
  const analyticHref = buildDashboardHref({
    pathname: "/dashboard/campanhas",
    verticalTag: initialVerticalTag,
    deliveryGroup: initialDeliveryGroup,
    rangeDays: initialRangeDays
  });

  return (
    <main className="mx-auto w-full max-w-[1280px] overflow-x-clip px-5 py-6 sm:px-6 lg:px-8">
      <header className="surface-panel enter-fade p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-viasoft/20 bg-viasoft/5 px-2.5 py-1.5 text-viasoft">
              <span className="inline-flex size-6 items-center justify-center rounded-lg bg-viasoft text-white">
                <BrandMark variant="icon" size={13} />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                {PUBLICATION_NAME}
              </span>
            </div>
            <h1 className="mt-1 text-3xl font-semibold text-viasoft">Resumo executivo</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Esta visão foi preparada para consolidar KPIs, rankings, distribuições e leituras
              gerenciais. Os filtros globais já são preservados pela URL para manter continuidade
              com a análise por campanha.
            </p>
          </div>
          <Link
            href={analyticHref}
            className="hover-lift inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-viasoft px-4 text-sm font-semibold text-white shadow-sm shadow-viasoft/25 transition hover:bg-viasoft-700 active:bg-viasoft-800"
          >
            Abrir análise por campanha
            <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      <section className="surface-panel mt-5 p-5 sm:p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-viasoft">
              Vertical
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {initialVerticalTag ?? "Todas as verticais"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-viasoft">
              Veiculação
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {getDeliveryLabel(initialDeliveryGroup)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-viasoft">
              Período
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              Últimos {initialRangeDays} dias
            </p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-3">
        <article className="surface-panel p-6">
          <div className="inline-flex size-10 items-center justify-center rounded-2xl bg-viasoft/10 text-viasoft">
            <LayoutDashboard size={20} />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-viasoft">Base pronta para KPIs consolidados</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Esta rota já recebe e preserva os filtros globais. No próximo passo, ela pode consumir
            payload próprio para trazer leitura gerencial sem depender de campanha selecionada.
          </p>
        </article>

        <article className="surface-panel p-6">
          <div className="inline-flex size-10 items-center justify-center rounded-2xl bg-viasoft/10 text-viasoft">
            <LineChart size={20} />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-viasoft">Pronta para evolução independente</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            A visão executiva fica desacoplada da tela analítica atual. Isso evita inflar o
            `DashboardClient` e permite evoluir rankings, tabelas e distribuições em um componente
            próprio.
          </p>
        </article>

        <article className="surface-panel p-6">
          <div className="inline-flex size-10 items-center justify-center rounded-2xl bg-viasoft/10 text-viasoft">
            <Target size={20} />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-viasoft">Navegação contextual prevista</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Ao clicar em uma campanha nesta visão, o fluxo previsto já está definido para abrir a
            análise detalhada com `campaignId` e os filtros globais preservados pela URL.
          </p>
        </article>
      </section>
    </main>
  );
}
