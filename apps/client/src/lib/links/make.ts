import {type ActivityTypeId} from '@splito/sync'

import {type NavigationProp} from '#/lib/routes/types'
import {buildPath, type LinkTarget} from './resolve'
import {webLink} from './hosts'

/**
 * The https link for a screen, printed with this build's tier host: what invites, QR codes, "Copy link", share
 * and reminders carry. It is the inverse of `resolveLink`, so a link made here opens the same screen (tested).
 */
export function linkTo(name: LinkTarget['name'], params: Record<string, string> = {}, sheets: string[] = [], query: Record<string, string> = {}) {
  return webLink(buildPath({name, params, sheets, query}))
}

/** The in-app path for a screen (`/people/abc`), for `openLink`: screens open their targets through the resolver too. */
export function pathTo(name: LinkTarget['name'], params: Record<string, string> = {}, sheets: string[] = [], query: Record<string, string> = {}) {
  return buildPath({name, params, sheets, query})
}

/**
 * Where a person opens (owner 178, 206): me -> Profile, anyone else (removed or unknown too) -> their page. The one
 * rule behind `PersonLink`, `openPerson` and every link or push that names a person.
 */
export function personPath(personId: string, isMe: boolean) {
  return isMe ? pathTo('Profile') : pathTo('Person', {personId})
}

/** Opens a person's page by the same rule as `personPath` (for a handler that cannot be a link). */
export function openPerson(navigation: Pick<NavigationProp, 'push' | 'navigate'>, personId: string, myId: string, action: 'push' | 'navigate' = 'push') {
  const go = action === 'push' ? navigation.push : navigation.navigate
  if (personId === myId) go.call(navigation, 'Profile')
  else go.call(navigation, 'Person', {personId})
}

/**
 * Activity behind every "see all" of past events (owners 173, 179, 192-195): All tab (so a saved Me or Others never
 * narrows it), the types named, and the group and/or friend the link sits in. Opened with `navigationAction="push"`
 * (or `openLink`) it lands as a pushed page with Back. The tab is a query here because `Link` matches a bare route
 * pattern (`/activity`); the address bar prints it as `/activity/all`.
 */
export function activityPath({types = [], groupId, personId}: {types?: readonly ActivityTypeId[]; groupId?: string; personId?: string} = {}) {
  return `/activity?${new URLSearchParams({tab: 'all', ...(types.length > 0 ? {type: types.join() === 'expenses,payments' ? 'transactions' : types.join(',')} : {}), ...(groupId ? {group: groupId} : {}), ...(personId ? {person: personId} : {})})}`
}

/** Every transactions heading, count and "See all": Expenses and Payments (owners 173, 193). */
export function seeAllTransactionsPath({groupId, personId}: {groupId?: string; personId?: string} = {}) {
  return activityPath({types: ['expenses', 'payments'], groupId, personId})
}

/** Every disputed amount or count (owner 192): Expenses, Payments and Disputes. */
export function seeDisputedPath({groupId, personId}: {groupId?: string; personId?: string} = {}) {
  return activityPath({types: ['expenses', 'payments', 'disputes'], groupId, personId})
}

/** Every request and invite count or "See all" (owner 195): Friends and invites. */
export function seeRequestsPath() {
  return activityPath({types: ['friends']})
}
