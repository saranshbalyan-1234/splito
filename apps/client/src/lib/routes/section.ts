import {type State} from '#/lib/routes/types'

/* The sidebar / bottom-bar item each route belongs to. */
const SECTION: Record<string, string> = {
  People: 'People',
  Person: 'People',
  AddFriend: 'People',
  InviteLinks: 'People',
  CreateInvite: 'People',
  ShareInvite: 'People',
  Invite: 'People',
  Groups: 'Groups',
  Group: 'Groups',
  CreateGroup: 'Groups',
  Settle: 'Groups',
  Analytics: 'Analytics',
  Activity: 'Activity',
  Settings: 'Settings',
  SettingsSection: 'Settings',
  SignIn: 'Settings',
  RecentlyDeleted: 'Settings',
  FriendsAndInvites: 'Settings',
}

/**
 * The nav item to light for the web's flat stack. A pushed page keeps the
 * section it was opened from lit, as Bluesky's tab stays lit under a pushed
 * screen: an expense opened from a friend lights People, Profile opened from
 * the Groups header lights Groups.
 */
export function currentSection(
  state: State | undefined,
  /** Only these items exist (the bottom bar has no Settings): others are skipped. */
  among?: readonly string[],
): string {
  const routes = state?.routes ?? []
  for (let i = routes.length - 1; i >= 0; i--) {
    const section = SECTION[routes[i]!.name]
    if (section && (!among || among.includes(section))) return section
  }
  return among?.[0] ?? 'People'
}
