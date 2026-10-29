import {setStringAsync} from 'expo-clipboard'

import {openExternal} from '#/lib/openExternal'
import {shareSheet} from '#/lib/sharing'

/**
 * What happened to the text: the system share sheet or WhatsApp opened (`shared`), it was copied because
 * this browser has no share sheet (`copied`), or the person closed the sheet without choosing an app
 * (`cancelled`). None of them says the message was sent: Splito cannot see that.
 */
export type ShareResult = 'shared' | 'copied' | 'cancelled'

/** Hands plain text to the share sheet: native sheet, the Web Share API, else the clipboard. */
export async function shareText(text: string): Promise<ShareResult> {
  const result = await shareSheet({text})
  if (result !== 'unavailable') return result
  await setStringAsync(text)
  return 'copied'
}

/** Copies the text (the sheet's Copy button). */
export async function copyReminder(text: string): Promise<void> {
  await setStringAsync(text)
}

/** Opens WhatsApp at a chat with the text filled in (the app on phones, WhatsApp Web on a computer). */
export function openWhatsapp(url: string): Promise<void> {
  return openExternal(url)
}
