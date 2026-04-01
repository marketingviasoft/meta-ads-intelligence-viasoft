export function resolvePdfPagePlan(params: {
  hasAdSetComparisonSelection: boolean;
  hasAdComparisonSelection: boolean;
}) {
  const shouldRenderComparisonPage =
    params.hasAdSetComparisonSelection || params.hasAdComparisonSelection;

  return {
    shouldRenderComparisonPage,
    totalPages: shouldRenderComparisonPage ? 5 : 4,
    metricsPageNumber: shouldRenderComparisonPage ? 3 : 2,
    trendPageNumber: shouldRenderComparisonPage ? 4 : 3,
    insightsPageNumber: shouldRenderComparisonPage ? 5 : 4
  };
}
