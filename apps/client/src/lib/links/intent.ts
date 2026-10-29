import {device} from '#/storage'

/**
 * Sign-in preserves intent (ARCHITECTURE 14, F-254): a link opened signed out keeps its relative target, the
 * person signs in (intro, Continue), and the app resumes there. Splito has no sign-in gate yet (F-250), so
 * `isSignInRequired` is false and nothing is held; the store, the hook and `openLink` are ready for it.
 * ponytail: one slot; a second link before sign-in replaces the first. Upgrade: none needed.
 */
export const isSignInRequired = () => false

/** Keeps a link's path for after sign-in. Tokens and codes in it are scrubbed from logs by `#/logger`. */
export function holdLinkIntent(path: string) {
  device.set(['linkIntent'], path)
}

/** The held link, once: reading it clears it. */
export function takeLinkIntent(): string | undefined {
  const path = device.get(['linkIntent'])
  if (path) device.remove(['linkIntent'])
  return path
}
