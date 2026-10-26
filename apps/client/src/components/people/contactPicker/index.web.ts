import {type PickedContact} from './types'

export type {PickedContact} from './types'

/*
 * The Contact Picker API (Chrome on Android today). Where the browser lacks
 * it the button is hidden (26.18). The browser shows its own consent sheet,
 * so there is no permission step or primer on web.
 */
type ContactsManager = {
  select(
    props: Array<'name' | 'email' | 'tel'>,
    options: {multiple: boolean},
  ): Promise<Array<{name?: string[]; email?: string[]; tel?: string[]}>>
}

function manager(): ContactsManager | undefined {
  if (typeof navigator === 'undefined') return undefined
  return (navigator as Navigator & {contacts?: ContactsManager}).contacts
}

export function canPickContacts() {
  return typeof manager()?.select === 'function'
}

export async function contactsPermission(): Promise<'granted' | 'undetermined' | 'denied'> {
  return 'granted'
}

export async function requestContactsPermission() {
  return true
}

export function openContactsSettings() {}

export async function pickContact(): Promise<PickedContact | null> {
  const picked = await manager()?.select(['name', 'email', 'tel'], {multiple: false})
  const c = picked?.[0]
  if (!c) return null
  return {
    name: c.name?.[0] ?? '',
    values: [
      ...(c.tel ?? []).map(raw => ({kind: 'phone' as const, raw})),
      ...(c.email ?? []).map(raw => ({kind: 'email' as const, raw})),
    ],
  }
}
