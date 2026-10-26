import {getLocales} from 'expo-localization'
import {
  createInviteLink,
  demoDirectory,
  type DirectoryClient,
  type Entity,
  type InviteLink,
  mintInviteCode,
  type MutationCtx,
  offlineDirectory,
  type Store,
} from '@splito/sync'

import {IS_DEMO} from '#/data/demo'
import {DEMO_DIRECTORY} from '#/data/demoData'

/**
 * The directory and invite API (26.18). Production has no backend yet, so
 * lookups are 'unavailable' and sends stay queued; only demo mode answers.
 */
export const directory: DirectoryClient & {
  accountFor?: ReturnType<typeof demoDirectory>['accountFor']
} = IS_DEMO ? demoDirectory(DEMO_DIRECTORY) : offlineDirectory

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
