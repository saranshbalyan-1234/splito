/**
 * The one hook pull to refresh (and the re-tap of the active tab) calls to reach the network (ARCHITECTURE 9.3, F-233):
 * refresh FX rates when online, then drain the outbox and pull. Neither exists yet, so this is honestly a no-op;
 * F-2103 fills it in and every screen's refresh gets it with no screen change. Never throws, never shows an error
 * (offline ends at once with the status label, never a toast).
 */
export async function syncNow(): Promise<void> {
  // `navigator.onLine` is undefined on React Native, where the sync engine will ask the network state itself.
  const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false
  if (!isOnline) return
  // TODO(F-2103): FX rates, then drain the outbox, then pull.
}
