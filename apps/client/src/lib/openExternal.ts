import {Linking} from 'react-native'

import {IS_E2E, IS_WEB} from '#/env'

type TestHooks = {externalUrls?: string[]}

/**
 * Hands a link to another app (mail, phone, WhatsApp, UPI, a browser tab).
 * E2E builds never leave the page: a real browser would pass `mailto:` or
 * `tel:` to the operating system and open the owner's Mail app, so the URL is
 * recorded in `window.__splitoTest.externalUrls` for the spec to read instead.
 * `how: 'location'` is the web way of opening a mail draft without a blank tab.
 */
export async function openExternal(url: string, how: 'linking' | 'location' | 'anchor' = 'linking'): Promise<void> {
  if (IS_E2E && typeof window !== 'undefined') {
    const w = window as unknown as {__splitoTest?: TestHooks}
    w.__splitoTest = {...w.__splitoTest, externalUrls: [...(w.__splitoTest?.externalUrls ?? []), url]}
    return
  }
  if (IS_WEB && how === 'location') {
    window.location.href = url
    return
  }
  if (IS_WEB && how === 'anchor') {
    // An anchor click is how mobile browsers hand a custom scheme to the installed app; the page stays where it is.
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
