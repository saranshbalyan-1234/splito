// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/lib/sharing.ts
import {Share} from 'react-native'
import {setStringAsync} from 'expo-clipboard'
import {t} from '@lingui/core/macro'

import {openExternal, testHandOffs} from '#/lib/openExternal'
import * as Toast from '#/components/Toast'
import {IS_ANDROID, IS_E2E, IS_IOS, IS_NATIVE, IS_WEB} from '#/env'

/** What happened at the share sheet: shown, closed without choosing an app, or this device has none. */
export type ShareSheetResult = 'shared' | 'cancelled' | 'unavailable'

/**
 * The one way to open the system share sheet (native `Share.share`, the Web Share API); no other file may call
 * either. An e2e build never opens a sheet: it records the text on `window.__splitoTest.sharedTexts` (owner 118),
 * so a test can assert what would have been shared without handing anything to a real app.
 */
export async function shareSheet({text, url}: {text?: string; url?: string}): Promise<ShareSheetResult> {
  if (IS_E2E && IS_WEB) {
    testHandOffs().sharedTexts.push([text, url].filter(Boolean).join(' '))
    return 'shared'
  }
  if (IS_IOS) {
    const result = await Share.share(url ? {url, message: text} : {message: text ?? ''})
    return result.action === Share.dismissedAction ? 'cancelled' : 'shared'
  }
  if (IS_ANDROID) {
    const result = await Share.share({message: [text, url].filter(Boolean).join(' ')})
    return result.action === Share.dismissedAction ? 'cancelled' : 'shared'
  }
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share({url, text})
      return 'shared'
    } catch (e) {
      // Closing the sheet rejects with AbortError; anything else is as good as no sheet.
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled'
    }
  }
  return 'unavailable'
}

/**
 * What happened to shared content: the system share sheet opened (`shared`), it was copied because this
 * browser has no share sheet (`copied`), or the person closed the sheet without choosing an app
 * (`cancelled`). None of them says the message was sent: Splito cannot see that.
 */
export type ShareResult = 'shared' | 'copied' | 'cancelled'

/**
 * Copies text. The default confirms with a toast; pass `toast: false` where the caller shows its own
 * confirmation (the invite field's floating "Copied!", the Remind sheet's closing toast).
 */
export async function copyText(text: string, {toast = true}: {toast?: boolean} = {}) {
  await setStringAsync(text)
  if (toast) Toast.show(t`Copied to clipboard`, {type: 'success'})
}

/**
 * Shares text and/or a link: the native share sheet on iOS and Android, the Web Share API where the
 * browser has it, otherwise (most desktop browsers) the content is copied (section 2: a missing
 * capability is a planned fallback). `toast` confirms that fallback copy.
 */
async function share(content: {text?: string; url?: string}, toast: boolean): Promise<ShareResult> {
  const result = await shareSheet(content)
  if (result !== 'unavailable') return result
  await copyText(content.url ?? content.text ?? '', {toast})
  return 'copied'
}

/** Hands plain text to the share sheet, else the clipboard (silently: the caller words the outcome). */
export function shareText(text: string): Promise<ShareResult> {
  return share({text}, false)
}

/** Shares a link with a line of text; where there is no share sheet the link is copied and a toast says so. */
export async function shareUrl(url: string, message?: string) {
  await share({url, text: message}, true)
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
