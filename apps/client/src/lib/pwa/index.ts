export {usePwa} from '#/lib/pwa/state'
export {hasWorkAtStake, useWorkAtStake} from '#/lib/pwa/workAtStake'

/* Native has no service worker, install prompt or web updates: the app stores handle all three. */
export function startPwa() {}
export function applyUpdate() {}
export async function install(): Promise<
  'accepted' | 'dismissed' | 'help' | 'unavailable'
> {
  return 'unavailable'
}
