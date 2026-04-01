import { describe, expect, it } from "vitest";
import { getCreativeFeedback, getPreviewFailureFeedback } from "@/utils/ad-preview";

describe("Ad preview fallbacks", () => {
  it("flags creative enrichment as pending when name and thumbnail are both missing", () => {
    expect(
      getCreativeFeedback({
        creativeName: "Criativo não identificado",
        creativePreviewUrl: ""
      })
    ).toEqual(
      expect.objectContaining({
        category: "not_enriched",
        label: "Enriquecimento pendente"
      })
    );
  });

  it("distinguishes permission-blocked previews from generic unavailability", () => {
    expect(
      getPreviewFailureFeedback({
        ad: {
          creativeName: "Criativo institucional",
          creativePreviewUrl: ""
        },
        errorMessage: "A Meta bloqueou este preview por permissão ou política do perfil."
      })
    ).toEqual(
      expect.objectContaining({
        category: "permission_blocked",
        title: "Preview bloqueado pela Meta"
      })
    );

    expect(
      getPreviewFailureFeedback({
        ad: {
          creativeName: "Criativo institucional",
          creativePreviewUrl: ""
        },
        errorMessage: "A Meta retornou um preview não incorporável para este anúncio."
      })
    ).toEqual(
      expect.objectContaining({
        category: "preview_unavailable",
        title: "Preview indisponível"
      })
    );
  });
});
