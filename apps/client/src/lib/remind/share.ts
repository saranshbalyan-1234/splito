import {Linking, Share} from 'react-native'
import {setStringAsync} from 'expo-clipboard'

import {IS_NATIVE} from '#/env'

/**
 * What happened to the text: the system share sheet or WhatsApp opened (`shared`), it was copied because
 * this browser has no share sheet (`copied`), or the person closed the sheet without choosing an app
 * (`cancelled`). None of them says the message was sent: Splito cannot see that.
 */
export type ShareResult = 'shared' | 'copied' | 'cancelled'

/** Hands plain text to the share sheet: native sheet, the Web Share API, else the clipboard. */
export async function shareText(text: string): Promise<ShareResult> {
  if (IS_NATIVE) {
    const result = await Share.share({message: text})
    return result.action === Share.dismissedAction ? 'cancelled' : 'shared'
  }
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share({text})
      return 'shared'
    } catch (e) {
      // Closing the sheet rejects with AbortError; anything else falls back to the clipboard.
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled'
    }
  }
  await setStringAsync(text)
  return 'copied'
}

/** Copies the text (the sheet's Copy button). */
export async function copyReminder(text: string): Promise<void> {
  await setStringAsync(text)
}

/** Opens WhatsApp at a chat with the text filled in (the app on phones, WhatsApp Web on a computer). */
export async function openWhatsapp(url: string): Promise<void> {
  if (IS_NATIVE) await Linking.openURL(url)
  else window.open(url, '_blank', 'noopener')
}
