import {isSignedIn} from '#/state/session'
import {device} from '#/storage'
import {publicPageFor} from './public'
import {buildPath, resolveLink} from './resolve'

/**
 * Sign-in preserves intent (ARCHITECTURE 14, F-254, F-250): a link opened signed out keeps its relative target, the
 * person goes through the intro and Continue, and the app resumes there (`LinkHost`). Sign-in is required, so every
 * link is held until someone is signed in.
 * ponytail: one slot; a second link before sign-in replaces the first. Upgrade: none needed.
 */
export const isSignInRequired = () => !isSignedIn()

/** Keeps a link's path for after sign-in. Tokens and codes in it are scrubbed from logs by `#/logger`. */
export function holdLinkIntent(path: string) {
  device.set(['linkIntent'], path)
}

/** A link opened while signed out (the address the page loaded with, a cold-start or later URL): held when it names somewhere inside the app. Home and the intro itself are not "somewhere". */
export function holdSignedOutLink(input: string) {
  /* The legal and help pages and a public invite page are shown as they are; there is nothing to resume. */
  if (publicPageFor(input)) return
  const {isKnown, target} = resolveLink(input)
  if (!isKnown || target.name === 'Welcome') return
  const path = buildPath(target)
  if (path !== '/') holdLinkIntent(path)
}

/** The held link, once: reading it clears it. */
export function takeLinkIntent(): string | undefined {
  const path = device.get(['linkIntent'])
  if (path) device.remove(['linkIntent'])
  return path
}
