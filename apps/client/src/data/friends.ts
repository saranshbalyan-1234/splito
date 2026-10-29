import {getLocales} from 'expo-localization'
import {
  createInviteLink,
  type DirectoryClient,
  type Entity,
  type InviteLink,
  mintInviteCode,
  type MutationCtx,
  offlineDirectory,
  type Store,
} from '@splito/sync'

let active: DirectoryClient = offlineDirectory

/** Dev and e2e demo mode swaps the directory that answers (`#/data/demoMode`); turning it off puts the offline one back. */
export function setDirectory(next: DirectoryClient | null) {
  active = next ?? offlineDirectory
}

/** True when a directory answers (demo mode today, the backend later); false offline, where invite links fail closed. */
export function isDirectoryAvailable() {
  return active !== offlineDirectory
}

/**
 * The directory and invite API (26.18). Production has no backend yet, so
 * lookups are 'unavailable' and sends stay queued; only demo mode answers.
 */
export const directory: DirectoryClient = {
  get isDemo() {
    return active.isDemo
  },
  lookup: contact => active.lookup(contact),
  sendRequest: id => active.sendRequest(id),
  createInviteLink: code => active.createInviteLink(code),
  revoke: code => active.revoke(code),
  accept: target => active.accept(target),
  openInvite: code => active.openInvite(code),
}

/**
 * Makes an invite link: the directory registers the code first, and only then
 * is the link recorded. Offline it answers 'unavailable' and nothing is
 * minted (section 10: invite links fail closed, never a fabricated URL).
 */
export async function makeInviteLink(
  store: Store,
  ctx: MutationCtx,
  input: Omit<Parameters<typeof createInviteLink>[2], 'code'>,
): Promise<Entity<InviteLink> | 'unavailable'> {
  const code = mintInviteCode(ctx)
  if ((await directory.createInviteLink(code)) !== 'created') return 'unavailable'
  return createInviteLink(store, ctx, {...input, code})
}

/** Where invite links point: the web path, which the app also claims (section 14). */
export const INVITE_HOST = 'https://splito.app'

export function inviteUrl(code: string) {
  return `${INVITE_HOST}/invite/${code}`
}

/** The region phone numbers default to: the device's, else India (Splito's first market). */
export function deviceRegion(): string {
  return getLocales()[0]?.regionCode ?? 'IN'
}
