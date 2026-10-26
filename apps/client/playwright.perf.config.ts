import {defineConfig} from '@playwright/test'

/*
 * Store-read and render counts for a save on a large ledger (ARCHITECTURE
 * 17 render gate). Build first (`pnpm e2e:build`); PERF_DIST compares another
 * build (say main's) on the same flow. Prints numbers; asserts only sanity.
 */
const PORT = Number(process.env.E2E_PORT ?? 8081)
const DIST = process.env.PERF_DIST ?? 'dist'

export default defineConfig({
  testDir: 'perf',
  timeout: 600_000,
  workers: 1,
  use: {baseURL: `http://localhost:${PORT}`, channel: 'chrome'},
  webServer: {command: `npx --yes serve@14 -s ${DIST} -l ${PORT}`, port: PORT, reuseExistingServer: false},
})
