// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/contacts/screens/GetContacts.tsx (permission check, expo-contacts/legacy)
import {Linking} from 'react-native'
import * as Contacts from 'expo-contacts/legacy'

import {type PickedContact} from './types'

export type {PickedContact} from './types'

/** Native: the system contacts picker is always there. */
export function canPickContacts() {
  return true
}

/**
 * Native asks the OS for contacts access, after Splito's own primer (F-216):
 * 'undetermined' means show the primer first; 'denied' means point to Settings.
 */
export async function contactsPermission(): Promise<'granted' | 'undetermined' | 'denied'> {
  const {status, canAskAgain} = await Contacts.getPermissionsAsync()
  if (status === 'granted') return 'granted'
  return canAskAgain ? 'undetermined' : 'denied'
}

/** Asks the OS (call only after the primer). */
export async function requestContactsPermission() {
  return (await Contacts.requestPermissionsAsync()).granted
}

export function openContactsSettings() {
  void Linking.openSettings()
}

/** The system picker: one contact, or null when dismissed. */
export async function pickContact(): Promise<PickedContact | null> {
  const c = await Contacts.presentContactPickerAsync()
  if (!c) return null
  return {
    name: c.name ?? [c.firstName, c.lastName].filter(Boolean).join(' '),
    values: [
      ...(c.phoneNumbers ?? []).flatMap(p =>
        p.number ? [{kind: 'phone' as const, raw: p.number, label: p.label}] : [],
      ),
      ...(c.emails ?? []).flatMap(e =>
        e.email ? [{kind: 'email' as const, raw: e.email, label: e.label}] : [],
      ),
    ],
  }
}
