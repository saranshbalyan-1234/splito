import {Linking} from 'react-native'

import {IS_E2E, IS_WEB} from '#/env'

/** Schemes that leave the browser for an installed app (Mail, Messages, a UPI app). */
const HAND_OFF = /^(mailto|tel|sms|upi|whatsapp):/i

/**
 * The one way to open a link outside the app. E2E builds record hand-off
 * links on `window.__splitoTest.externalUrls` instead of opening them, so a
 * test run never launches the owner's Mail. On the web a hand-off is an
 * anchor click (the page stays; `Linking.openURL` would open a blank tab).
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (IS_E2E && typeof window !== 'undefined' && HAND_OFF.test(url)) {
    const w = window as unknown as {__splitoTest?: {externalUrls: string[]}}
    ;(w.__splitoTest ??= {externalUrls: []}).externalUrls.push(url)
    return
  }
  if (IS_WEB && HAND_OFF.test(url)) {
    const link = document.createElement('a')
    link.href = url
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
    return
  }
  await Linking.openURL(url)
}
