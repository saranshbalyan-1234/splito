import {type Contact, contactKey} from '@splito/domain'

/*
 * The account directory and invite API (ARCHITECTURE 26.18). The backend
 * does not exist yet, so production uses `offlineDirectory`: every lookup is
 * 'unavailable' and every send stays queued in the outbox (the mutations put
 * it there), never a fake success. `demoDirectory` (dev and e2e builds with
 * ?demo=1 only) answers every branch from a fixed list.
 */

/** Exact match only; the directory never says more than this. */
export type Lookup = 'on-splito' | 'not-on-splito' | 'unavailable'
/** 'sent': the server took it. 'queued': it waits in the outbox. */
export type Delivery = 'sent' | 'queued'

export type DirectoryAccount = {accountId: string; name: string; contact: Contact | null}

export type InvitePreview = {
  kind: 'friend' | 'group'
  inviter: DirectoryAccount
  /** Group invites: the group's name. */
  groupName: string | null
}

export interface DirectoryClient {
  /** True only for the demo directory; screens label demo answers as such. */
  readonly isDemo: boolean
  lookup(contact: Contact): Promise<Lookup>
  sendRequest(requestId: string): Promise<Delivery>
  /** Invite links are access-granting: offline they fail closed ('unavailable'), never minted locally. */
  createInviteLink(code: string): Promise<'created' | 'unavailable'>
  revoke(code: string): Promise<Delivery>
  /** Accepting an incoming request or an invite code. */
  accept(target: string): Promise<Delivery>
  openInvite(code: string): Promise<InvitePreview | 'not-found' | 'unavailable'>
}

/** Production until the backend batch lands. */
export const offlineDirectory: DirectoryClient = {
  isDemo: false,
  lookup: async () => 'unavailable',
  sendRequest: async () => 'queued',
  createInviteLink: async () => 'unavailable',
  revoke: async () => 'queued',
  accept: async () => 'queued',
  openInvite: async () => 'unavailable',
}

/** A fake directory for demo mode, with a short delay so the checking state shows. */
export function demoDirectory({
  accounts,
  invites,
  latencyMs = 700,
}: {
  accounts: DirectoryAccount[]
  invites: Record<string, {kind: InvitePreview['kind']; inviter: string; groupName: string | null}>
  latencyMs?: number
}): DirectoryClient & {accountFor(contact: Contact): DirectoryAccount | undefined} {
  const byContact = new Map(accounts.flatMap(a => (a.contact ? [[contactKey(a.contact), a] as const] : [])))
  const byId = new Map(accounts.map(a => [a.accountId, a]))
  const later = <T>(v: T) => (latencyMs > 0 ? new Promise<T>(r => setTimeout(() => r(v), latencyMs)) : Promise.resolve(v))
  return {
    isDemo: true,
    accountFor: contact => byContact.get(contactKey(contact)),
    lookup: contact => later(byContact.has(contactKey(contact)) ? 'on-splito' : 'not-on-splito'),
    sendRequest: () => later('sent'),
    createInviteLink: () => later('created'),
    revoke: () => later('sent'),
    accept: () => later('sent'),
    openInvite: code => {
      const invite = invites[code]
      const inviter = invite && byId.get(invite.inviter)
      return later(invite && inviter ? {kind: invite.kind, inviter, groupName: invite.groupName} : 'not-found')
    },
  }
}
