import {getLocales} from 'expo-localization'
import {linkTo} from '#/lib/links/make'
import {
  applyGroupRequestAccepted,
  createInviteLink,
  type DirectoryClient,
  type Entity,
  type GroupRequest,
  type InviteLink,
  mintInviteCode,
  type MutationCtx,
  offlineDirectory,
  outgoingGroupRequests,
  type Store,
} from '@splito/sync'

let active: DirectoryClient = offlineDirectory

/** Dev and e2e demo mode swaps the directory that answers (`#/data/demoMode`); turning it off puts the offline one back. */
export function setDirectory(next: DirectoryClient | null) {
  active = next ?? offlineDirectory
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
  answerGroupRequest: accountId => active.answerGroupRequest(accountId),
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

/** Where invite links point: this build's tier host, whose paths the app also claims (section 14, F-254). */
export function inviteUrl(code: string) {
  return linkTo('Invite', {code})
}

/** The region phone numbers default to: the device's, else India (Splito's first market). */
export function deviceRegion(): string {
  return getLocales()[0]?.regionCode ?? 'IN'
}

/**
 * After friends were asked to join a group: the directory answers for the ones it can (demo mode's accounts say yes after
 * its usual delay, so a demo friend is never "Invited" forever; production waits for the server, F-2105). Fire and
 * forget: the row turns into a member when the answer lands. Only the invites this group still has waiting.
 */
export async function answerGroupInvites(store: Store, ctx: MutationCtx, groupId: string): Promise<void> {
  if (!directory.isDemo) return
  const waiting = outgoingGroupRequests(await store.getAll<GroupRequest>('groupRequest'), ctx.now()).filter(r => r.data.groupId === groupId && r.data.kind === 'invite' && r.data.accountId)
  for (const r of waiting)
    void directory
      .answerGroupRequest(r.data.accountId!)
      .then(account => (account ? applyGroupRequestAccepted(store, {...ctx, actor: account.accountId}, r.id, ctx.actor) : undefined))
      .catch(() => undefined) // cancelled or answered meanwhile: nothing to apply
}

/** Tells the directory that these group links stopped working (the group went invite only): after the change, like a revoked friend link. */
export async function revokeGroupLinks(codes: string[]): Promise<void> {
  await Promise.all(codes.map(code => directory.revoke(code).catch(() => undefined)))
}
