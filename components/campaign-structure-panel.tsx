"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Layers, Megaphone, X, ZoomIn } from "lucide-react";
import type { MetaAd, MetaAdPreview, MetaAdSet } from "@/lib/types";

type CampaignStructurePanelProps = {
  adSets: MetaAdSet[];
  selectedAdSetId: string;
  onSelectAdSet: (adSetId: string) => void;
  ads: MetaAd[];
  selectedCompareAdSetIds: string[];
  onToggleCompareAdSet: (adSetId: string) => void;
  selectedCompareAdIds: string[];
  onToggleCompareAd: (adId: string) => void;
  loadingAdSets: boolean;
  loadingAds: boolean;
  errorMessage?: string;
};

type AdPreviewResponse = {
  data?: MetaAdPreview;
  error?: string;
};

function listCountLabel(count: number, singular: string, plural: string): string {
  if (count === 1) {
    return `1 ${singular}`;
  }

  return `${count} ${plural}`;
}

function formatDestinationLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const pathDigits = parsed.pathname.replace(/\D/g, "");
    const queryPhoneDigits = parsed.searchParams.get("phone")?.replace(/\D/g, "") ?? "";

    if (host === "wa.me" || host.endsWith(".wa.me")) {
      const digits = pathDigits;
      return digits ? `WhatsApp +${digits}` : "WhatsApp";
    }

    if (host.includes("whatsapp.com")) {
      const digits = queryPhoneDigits || pathDigits;
      return digits ? `WhatsApp +${digits}` : "WhatsApp";
    }

    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.hostname}${path}`;
  } catch {
    return url;
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function CampaignStructurePanel({
  adSets,
  selectedAdSetId,
  onSelectAdSet,
  ads,
  selectedCompareAdSetIds,
  onToggleCompareAdSet,
  selectedCompareAdIds,
  onToggleCompareAd,
  loadingAdSets,
  loadingAds,
  errorMessage
}: CampaignStructurePanelProps) {
  const [selectedPreviewAd, setSelectedPreviewAd] = useState<MetaAd | null>(null);
  const [adPreviewByAdId, setAdPreviewByAdId] = useState<Record<string, MetaAdPreview>>({});
  const [adPreviewLoadingByAdId, setAdPreviewLoadingByAdId] = useState<Record<string, boolean>>({});
  const [adPreviewErrorByAdId, setAdPreviewErrorByAdId] = useState<Record<string, string>>({});
  const loadedAdPreviewIdsRef = useRef<Set<string>>(new Set());
  const loadingAdPreviewIdsRef = useRef<Set<string>>(new Set());

  const selectedAdSetName = adSets.find((adSet) => adSet.id === selectedAdSetId)?.name ?? "";
  const adSetSelectionLimitReached = selectedCompareAdSetIds.length >= 2;
  const adSelectionLimitReached = selectedCompareAdIds.length >= 2;
  const adSetCompareCount = selectedCompareAdSetIds.length;
  const adCompareCount = selectedCompareAdIds.length;

  useEffect(() => {
    setSelectedPreviewAd(null);
  }, [selectedAdSetId]);

  const loadAdPreview = useCallback(async (adId: string): Promise<void> => {
    if (!adId) {
      return;
    }

    if (loadedAdPreviewIdsRef.current.has(adId) || loadingAdPreviewIdsRef.current.has(adId)) {
      return;
    }

    loadingAdPreviewIdsRef.current.add(adId);
    setAdPreviewLoadingByAdId((previous) => ({
      ...previous,
      [adId]: true
    }));

    try {
      const response = await fetch(`/api/meta/ad-preview?adId=${encodeURIComponent(adId)}`, {
        cache: "no-store"
      });

      const payload = (await response.json().catch(() => null)) as AdPreviewResponse | null;
      if (!response.ok) {
        throw new Error(payload?.error || `Erro ao buscar preview (${response.status})`);
      }

      const preview = payload?.data;
      if (!preview?.iframeUrl) {
        throw new Error("Preview avançado indisponível para este anúncio.");
      }

      setAdPreviewByAdId((previous) => ({
        ...previous,
        [adId]: preview
      }));
      loadedAdPreviewIdsRef.current.add(adId);
      setAdPreviewErrorByAdId((previous) => {
        const next = { ...previous };
        delete next[adId];
        return next;
      });
    } catch (error) {
      setAdPreviewErrorByAdId((previous) => ({
        ...previous,
        [adId]:
          error instanceof Error ? error.message : "Não foi possível carregar o preview avançado."
      }));
    } finally {
      loadingAdPreviewIdsRef.current.delete(adId);
      setAdPreviewLoadingByAdId((previous) => ({
        ...previous,
        [adId]: false
      }));
    }
  }, []);

  function openPreviewModal(ad: MetaAd): void {
    setSelectedPreviewAd(ad);
    void loadAdPreview(ad.id);
  }

  const closePreviewModal = useCallback((): void => {
    setSelectedPreviewAd(null);
  }, []);

  useEffect(() => {
    if (!selectedPreviewAd) {
      return;
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        closePreviewModal();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closePreviewModal, selectedPreviewAd]);

  useEffect(() => {
    if (!selectedPreviewAd) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedPreviewAd]);

  const activePreview = selectedPreviewAd ? adPreviewByAdId[selectedPreviewAd.id] : undefined;
  const activePreviewLoading = selectedPreviewAd ? adPreviewLoadingByAdId[selectedPreviewAd.id] : false;
  const activePreviewError = selectedPreviewAd ? adPreviewErrorByAdId[selectedPreviewAd.id] : "";

  return (
    <section data-dashboard-block="campaign-structure" className="surface-panel p-4 sm:p-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-viasoft">
            <Layers size={17} className="text-viasoft" />
            Estrutura da campanha
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Navegue pelos grupos de anúncios e pelos anúncios dentro de cada grupo.
          </p>
        </div>
      </header>

      {errorMessage ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="min-w-0 text-xs font-semibold uppercase tracking-[0.08em] text-viasoft">
              Grupos de anúncios
            </p>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-viasoft/20 bg-viasoft/5 px-2 py-0.5 text-[11px] font-semibold text-viasoft">
                {adSetCompareCount}/2 em comparação
              </span>
              <span className="shrink-0 whitespace-nowrap text-xs text-slate-500">
                {loadingAdSets ? "Carregando..." : listCountLabel(adSets.length, "grupo", "grupos")}
              </span>
            </div>
          </div>

          {loadingAdSets ? (
            <div className="space-y-2">
              <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : adSets.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-500">
              Nenhum grupo de anúncios encontrado para esta campanha.
            </p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto overflow-x-hidden pr-1">
              {adSets.map((adSet) => {
                const selected = adSet.id === selectedAdSetId;
                const compareChecked = selectedCompareAdSetIds.includes(adSet.id);
                const compareDisabled = !compareChecked && adSetSelectionLimitReached;

                return (
                  <li
                    key={adSet.id}
                    className={`rounded-xl border p-2 transition ${
                      compareChecked
                        ? "border-viasoft/30 bg-viasoft/5"
                        : "border-transparent bg-transparent"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectAdSet(adSet.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                        selected
                          ? "border-viasoft/30 bg-viasoft/10 text-viasoft"
                          : "border-slate-200 bg-white text-slate-700 hover:border-viasoft/20 hover:bg-viasoft/5"
                      }`}
                    >
                      <p className="break-words font-medium leading-5">{adSet.name}</p>
                    </button>
                    <label
                      className={`mt-2 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${
                        compareChecked
                          ? "border-viasoft/30 bg-viasoft/10 text-viasoft"
                          : compareDisabled
                            ? "border-slate-200 bg-slate-100 text-slate-400"
                            : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-viasoft focus:ring-viasoft/30"
                        checked={compareChecked}
                        disabled={compareDisabled}
                        onChange={() => onToggleCompareAdSet(adSet.id)}
                      />
                      {compareChecked ? "Comparando" : "Comparar"}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-viasoft">
              <Megaphone size={14} />
              Anúncios
            </p>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
                {adCompareCount}/2 em comparação
              </span>
              <span className="shrink-0 whitespace-nowrap text-xs text-slate-500">
                {loadingAds ? "Carregando..." : listCountLabel(ads.length, "anúncio", "anúncios")}
              </span>
            </div>
          </div>

          {!selectedAdSetId ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-500">
              Selecione um grupo de anúncios para visualizar os anúncios.
            </p>
          ) : loadingAds ? (
            <div className="space-y-2">
              <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : ads.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-500">
              Nenhum anúncio encontrado no grupo selecionado.
            </p>
          ) : (
            <div>
              <p className="mb-2 break-words text-xs text-slate-500">
                Grupo selecionado: {selectedAdSetName}
              </p>
              <ul className="max-h-72 space-y-2 overflow-y-auto overflow-x-hidden pr-1">
                {ads.map((ad) => {
                  const compareChecked = selectedCompareAdIds.includes(ad.id);
                  const compareDisabled = !compareChecked && adSelectionLimitReached;

                  return (
                    <li
                      key={ad.id}
                      className={`rounded-lg border p-3 text-sm text-slate-700 ${
                        compareChecked
                          ? "border-teal-300 bg-teal-50/60"
                          : "border-slate-200 bg-slate-50/50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => openPreviewModal(ad)}
                          className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viasoft/35"
                          aria-label={`Abrir preview avançado do anúncio ${ad.name}`}
                          title="Abrir preview avançado"
                        >
                          {ad.creativePreviewUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={ad.creativePreviewUrl}
                              alt={`Criativo do anúncio ${ad.name}`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
                              Sem arte
                            </div>
                          )}
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 bg-black/20 backdrop-blur-[1.5px] transition group-hover:bg-black/30 group-hover:backdrop-blur-[2px]"
                          />
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-white">
                            <ZoomIn size={20} />
                          </span>
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-medium leading-5">{ad.name}</p>
                          <p className="mt-1 break-words text-xs text-slate-500">
                            Criativo: {ad.creativeName}
                          </p>
                          {ad.destinationUrl ? (
                            <p className="mt-1 break-words text-xs text-slate-500">
                              Destino:{" "}
                              {isHttpUrl(ad.destinationUrl) ? (
                                <a
                                  href={ad.destinationUrl}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="break-all text-viasoft underline-offset-2 hover:underline"
                                  title={ad.destinationUrl}
                                >
                                  {formatDestinationLabel(ad.destinationUrl)}
                                </a>
                              ) : (
                                <span className="break-all">{ad.destinationUrl}</span>
                              )}
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-slate-500">Destino: não informado</p>
                          )}
                          <label
                            className={`mt-2 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${
                              compareChecked
                                ? "border-teal-300 bg-teal-100/70 text-teal-700"
                                : compareDisabled
                                  ? "border-slate-200 bg-slate-100 text-slate-400"
                                  : "border-slate-200 bg-white text-slate-600"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-viasoft focus:ring-viasoft/30"
                              checked={compareChecked}
                              disabled={compareDisabled}
                              onChange={() => onToggleCompareAd(ad.id)}
                            />
                            {compareChecked ? "Comparando" : "Comparar"}
                          </label>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {selectedPreviewAd ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-5"
          onClick={closePreviewModal}
        >
          <div
            className="flex h-[90vh] w-full max-w-[900px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-900">{selectedPreviewAd.name}</p>
                <p className="mt-1 truncate text-xs text-slate-500">
                  Criativo: {selectedPreviewAd.creativeName}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Destino:{" "}
                  {selectedPreviewAd.destinationUrl && isHttpUrl(selectedPreviewAd.destinationUrl) ? (
                    <a
                      href={selectedPreviewAd.destinationUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="break-all text-viasoft underline-offset-2 hover:underline"
                      title={selectedPreviewAd.destinationUrl}
                    >
                      {formatDestinationLabel(selectedPreviewAd.destinationUrl)}
                    </a>
                  ) : selectedPreviewAd.destinationUrl ? (
                    <span>{selectedPreviewAd.destinationUrl}</span>
                  ) : (
                    "não informado"
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={closePreviewModal}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-viasoft/35"
                aria-label="Fechar preview avançado"
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-50 p-5">
              {activePreview?.iframeUrl ? (
                <div className="mx-auto w-full max-w-[660px] overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <iframe
                    src={activePreview.iframeUrl}
                    title={`Preview do anúncio ${selectedPreviewAd.name}`}
                    loading="lazy"
                    className="block w-full border-0 bg-white"
                    style={{ height: "clamp(440px, 64vh, 760px)" }}
                  />
                </div>
              ) : activePreviewLoading ? (
                <div className="mx-auto w-full max-w-[660px] rounded-xl border border-slate-200 bg-white p-4">
                  <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                  <div className="mt-3 h-24 animate-pulse rounded bg-slate-200" />
                  <div className="mt-3 h-72 animate-pulse rounded bg-slate-200" />
                  <p className="mt-3 text-xs text-slate-500">Carregando preview avançado...</p>
                </div>
              ) : selectedPreviewAd.creativePreviewUrl ? (
                <div className="mx-auto w-full max-w-[660px] overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedPreviewAd.creativePreviewUrl}
                    alt={`Preview do criativo ${selectedPreviewAd.name}`}
                    className="max-h-[64vh] w-full object-contain"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="mx-auto flex h-[500px] w-full max-w-[660px] items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-500">
                  Preview indisponível
                </div>
              )}
            </div>

            {activePreviewError ? (
              <p className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
                Preview avançado indisponível para este anúncio.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
