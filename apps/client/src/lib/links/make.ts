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
