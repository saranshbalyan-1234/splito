// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/lib/sharing.ts
import {Share} from 'react-native'
import {setStringAsync} from 'expo-clipboard'
import {t} from '@lingui/core/macro'

import {openExternal} from '#/lib/openExternal'
import * as Toast from '#/components/Toast'
import {IS_ANDROID, IS_E2E, IS_IOS, IS_NATIVE} from '#/env'

/**
 * Shares a link with a line of text: the native share sheet on iOS and
 * Android, the Web Share API where the browser has it, otherwise (most
 * desktop browsers) the link is copied and a toast says so (section 2:
 * a missing capability is a planned fallback).
 */
export async function shareUrl(url: string, message?: string) {
  if (IS_E2E) {
    // Chrome's share sheet can open the owner's Mail app: e2e builds only record the link.
    await openExternal(url)
  } else if (IS_IOS) {
    await Share.share({url, message})
  } else if (IS_ANDROID) {
    await Share.share({message: message ? `${message} ${url}` : url})
  } else if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share({url, text: message})
    } catch {
      // Dismissed: nothing to do.
    }
  } else {
    await copyText(url)
  }
}

/** Copies text and confirms with a toast. */
export async function copyText(text: string) {
  await setStringAsync(text)
  Toast.show(t`Copied to clipboard`, {type: 'success'})
}

/** True where `sms:` links open a messages app (phones). */
export function canSendSms() {
  return IS_NATIVE
}

/** Opens the messages app (phones) or the mail app with the invite filled in. */
export async function openComposeLink({
  channel,
  to,
  subject,
  body,
}: {
  channel: 'sms' | 'email'
  to: string
  subject?: string
  body: string
}) {
  const url =
    channel === 'sms'
      ? // iOS reads `&body`, Android `?body`; both accept `?&body`.
        `sms:${to}?&body=${encodeURIComponent(body)}`
      : `mailto:${to}?subject=${encodeURIComponent(subject ?? '')}&body=${encodeURIComponent(body)}`
  try {
    await openExternal(url)
  } catch {
    Toast.show(t`Couldn’t open an app for that. Copy the link instead.`, {
      type: 'error',
    })
  }
}
