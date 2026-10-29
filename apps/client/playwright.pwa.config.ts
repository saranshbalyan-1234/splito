import {defineConfig} from '@playwright/test'

/*
 * F-1901: builds the web app as the PREVIEW build (like production it registers the
 * service worker, which `pnpm e2e:build` and dev never do; a production build is refused until
 * the auth HTTP client exists), adds sw.js and serves it. About two minutes to build: run on its own with `pnpm e2e:pwa`.
 */
const PORT = Number(process.env.E2E_PWA_PORT ?? 8481)

export default defineConfig({
  testDir: 'e2e-pwa',
  // The update test rewrites dist-pwa/sw.js, so the specs run one at a time.
  workers: 1,
  timeout: 90_000,
  use: {baseURL: `http://localhost:${PORT}`, channel: 'chrome', trace: 'retain-on-failure'},
  webServer: {
    // E2E_PWA_REBUILD_SW=1 skips the two-minute export and only regenerates sw.js in the existing dist-pwa.
    command: `${process.env.E2E_PWA_REBUILD_SW ? 'true' : 'EXPO_PUBLIC_ENV=preview pnpm exec expo export -p web --clear --output-dir dist-pwa'} && EXPO_PUBLIC_ENV=preview node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/pwa.ts dist-pwa && npx --yes serve@14 -s dist-pwa -l ${PORT}`,
    port: PORT,
    timeout: 600_000,
    reuseExistingServer: false,
  },
})
