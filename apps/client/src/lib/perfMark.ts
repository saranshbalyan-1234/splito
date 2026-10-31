/**
 * User Timing marks for the launch budget (ARCHITECTURE 17: cold open to
 * the start tab). A mark costs microseconds and is read by the perf spec; nothing in
 * the app reads it. Never throws, where the platform has no User Timing (Hermes).
 */
export function perfMark(name: string, detail?: unknown) {
  try {
    globalThis.performance?.mark?.(name, detail === undefined ? undefined : {detail})
  } catch {
    // marks are optional
  }
}
