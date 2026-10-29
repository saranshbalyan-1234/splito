/**
 * Deferred link (F-254 acceptance 6), a documented stub. After an install from a link, the app's first open
 * should land on that link's target: the link is kept on the web page the person came from and handed over by the
 * app's first open, with no third-party SDK (ARCHITECTURE 26.3). The hand-over needs the server (a short-lived
 * claim keyed by the page's visit, read once by the first open), so it ships with the backend. Until then this
 * answers "nothing waiting". `LinkHost` calls it on the first launch only (`deferredLinkChecked`), so wiring the
 * endpoint is this one function and nothing at the call sites.
 */
export async function readDeferredLink(): Promise<string | null> {
  return null
}
