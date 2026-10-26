import {defineConfig} from '@playwright/test'

/* Runs against the exported web build. Build first: `pnpm e2e:build`. PORT lets parallel runs coexist. */
const PORT = Number(process.env.E2E_PORT ?? 8081)

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  use: {baseURL: `http://localhost:${PORT}`, channel: 'chrome', trace: 'retain-on-failure'},
  webServer: {command: `npx --yes serve@14 -s dist -l ${PORT}`, port: PORT, reuseExistingServer: false},
})
