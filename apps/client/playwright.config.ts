import {defineConfig} from '@playwright/test'

/* Runs against the exported web build. Build first: `pnpm e2e:build`. PORT lets parallel runs coexist. */
const PORT = Number(process.env.E2E_PORT ?? 8081)

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  /* Sign-in is required: every spec starts signed in as the dev account (e2e/globalSignIn.ts); signed-out specs opt out with `test.use(signedOut)`. */
  globalSetup: './e2e/globalSignIn.ts',
  use: {baseURL: `http://localhost:${PORT}`, channel: 'chrome', trace: 'retain-on-failure', storageState: `.auth/e2e-${PORT}.json`},
  webServer: {command: `npx --yes serve@14 -s dist -l ${PORT}`, port: PORT, reuseExistingServer: false},
})
