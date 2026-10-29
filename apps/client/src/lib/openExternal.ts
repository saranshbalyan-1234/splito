import {Linking} from 'react-native'

import {IS_E2E, IS_WEB} from '#/env'

/** Schemes that hand the page to another app (mail, phone, messages, payments, chat). */
const APP_SCHEME = /^(?:mailto|tel|sms|upi|whatsapp):/i

/** A chat link is a web address that opens the WhatsApp app; an e2e build records it like an app scheme. */
const CHAT_LINK = /^https:\/\/wa\.me\//i

declare global {
  interface Window {
    __splitoTest?: {externalUrls?: string[]; sharedTexts?: string[]; demoMode?: (on: boolean) => Promise<void>}
  }
}

/** What an e2e build records instead of handing something to another app (owner 118). */
export function testHandOffs() {
  // The demo-mode hook (data/demoMode.ts) shares this object and may have created it first.
  const hooks = (window.__splitoTest ??= {})
  return {externalUrls: (hooks.externalUrls ??= []), sharedTexts: (hooks.sharedTexts ??= [])}
}

/**
 * The one way to open something outside Splito (a mail draft, a UPI or chat
 * link, a web page). In an e2e build a link to another app is not opened but
 * recorded on `window.__splitoTest.externalUrls`, so a test can assert it
 * without launching the owner's Mail, Phone, WhatsApp or UPI app (shared text
 * is recorded the same way by `shareSheet` in `lib/sharing.ts`). Elsewhere a web page keeps
 * the page where it is for an app scheme (an anchor click is how browsers hand
 * a custom scheme to the installed app) and everything else goes through
 * `Linking`. Rejects when nothing can open the link.
 */
export async function openExternal(url: string): Promise<void> {
  if (IS_E2E && IS_WEB && (APP_SCHEME.test(url) || CHAT_LINK.test(url))) {
    testHandOffs().externalUrls.push(url)
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
