import {Linking} from 'react-native'

import {IS_E2E, IS_WEB} from '#/env'

/** Schemes that hand the page to another app (mail, phone, messages, payments, chat). */
const APP_SCHEME = /^(?:mailto|tel|sms|upi|whatsapp):/i

declare global {
  interface Window {
    __splitoTest?: {externalUrls: string[]}
  }
}

/**
 * The one way to open something outside Splito (a mail draft, a UPI or chat
 * link, a web page). In an e2e build a link to another app is not opened but
 * recorded on `window.__splitoTest.externalUrls`, so a test can assert it
 * without launching the owner's Mail or Phone app. Elsewhere a web page keeps
 * the page where it is for an app scheme (an anchor click is how browsers hand
 * a custom scheme to the installed app) and everything else goes through
 * `Linking`. Rejects when nothing can open the link.
 */
export async function openExternal(url: string): Promise<void> {
  if (IS_E2E && IS_WEB && APP_SCHEME.test(url)) {
    const test = (window.__splitoTest ??= {externalUrls: []})
    test.externalUrls.push(url)
    return
  }
  if (IS_WEB && APP_SCHEME.test(url)) {
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
