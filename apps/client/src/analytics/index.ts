/**
 * Bluesky ships product metrics; Splito collects none in M1. Adapted components
 * call `ax.metric(...)`, so this keeps their call sites unchanged.
 */
export function useAnalytics() {
  return {metric: (_event: string, _data?: Record<string, unknown>) => {}}
}
