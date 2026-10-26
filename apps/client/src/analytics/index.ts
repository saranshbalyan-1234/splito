import {recordMetric} from '#/logger'

const analytics = {
  /** Bluesky's `ax.metric(event, data)`, recorded as a scrubbed metric (enums, booleans, numbers only). */
  metric: (event: string, data?: Record<string, unknown>) => recordMetric(event, data),
}

/**
 * Adapted components call `ax.metric(...)` as in Bluesky; the call enqueues a
 * metric in `#/logger`, which sends nothing anywhere until a vendor exists
 * and Send diagnostics is on.
 */
export function useAnalytics() {
  return analytics
}
