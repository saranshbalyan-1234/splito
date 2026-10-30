/**
 * User Timing marks for the launch budget (ARCHITECTURE 17: cold open to
 * the start tab). A mark costs microseconds and is read by the perf spec; nothing in
 * the app reads it. Never throws, where the platform has no User Timing (Hermes).
 */
export function perfMark(name: string) {
  try {
    globalThis.performance?.mark?.(name)
  } catch {
    // marks are optional
  }
}
