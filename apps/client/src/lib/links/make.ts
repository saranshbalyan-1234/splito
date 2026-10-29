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
 * Every "See all" of Recent transactions (F-259, owner 173): Activity on its All tab with the transactions type
 * applied, scoped to a group from a Group page. Opened with `navigationAction="push"` (or `openLink`) it lands as a
 * pushed page with Back (owner 179). The tab is named so a saved Me or Others never narrows it.
 */
export function seeAllTransactionsPath(groupId?: string) {
  /* The tab is a query here because `Link` matches a bare route pattern (`/activity`); the address bar prints it as `/activity/all`. */
  return `/activity?${new URLSearchParams({tab: 'all', type: 'transactions', ...(groupId ? {group: groupId} : {})})}`
}
