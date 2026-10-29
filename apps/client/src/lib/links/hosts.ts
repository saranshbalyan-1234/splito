import linkHosts from '../../../link-hosts.json'
import {tierFrom} from '../../../link-tier'

/**
 * The link hosts of every tier, from the one JSON the app config also reads (ARCHITECTURE 14, 26.3). A build
 * claims only its own tier's host (`app.config.ts`); the resolver reads every tier's so a link copied from
 * another tier still lands on the same screen.
 */
export type Tier = keyof typeof linkHosts.tiers

export const LINK_SCHEME: string = linkHosts.scheme
export const TIER_HOSTS: Record<Tier, string> = linkHosts.tiers
export const APP_PATHS: readonly string[] = linkHosts.appPaths

export {tierFrom}

/** This build's tier (`EXPO_PUBLIC_TIER`). */
export function currentTier(): Tier {
  return tierFrom(process.env.EXPO_PUBLIC_TIER)
}

/** The host this build puts in the links it makes (invites, share, copy link). */
export function ownLinkHost(): string {
  return TIER_HOSTS[currentTier()]
}

/** `https://splito.app/<path>` for this build's tier. */
export function webLink(path: string): string {
  return `https://${ownLinkHost()}${path.startsWith('/') ? path : `/${path}`}`
}
