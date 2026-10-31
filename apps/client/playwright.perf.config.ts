import {defineConfig, devices} from '@playwright/test'

/*
 * Store-read and render counts for a save on a large ledger (ARCHITECTURE
 * 17 render gate). Build first (`pnpm e2e:build`); PERF_DIST compares another
 * build (say main's) on the same flow. Prints numbers; asserts only sanity.
 *
 * The sweep (perf/sweep.spec.ts, ARCHITECTURE 26.10 owner 189) has a project per engine: `sweep-webkit` (Playwright
 * WebKit, 1x CPU) and `sweep-chrome` (Chrome at 6x CPU, set in the spec). `pnpm perf` runs the other specs only;
 * run the sweep with `pnpm perf --project=sweep-webkit --project=sweep-chrome`.
 */
const PORT = Number(process.env.E2E_PORT ?? 8081)
const DIST = process.env.PERF_DIST ?? 'dist'

export default defineConfig({
  testDir: 'perf',
  timeout: 600_000,
  workers: 1,
  globalSetup: './e2e/globalSignIn.ts',
  /* The sweep walks 100+ interactions in one test: a missing element must fail its flow in seconds, not wait out the test. */
  use: {baseURL: `http://localhost:${PORT}`, actionTimeout: 20_000, storageState: `.auth/perf-${PORT}.json`},
  projects: [
    {name: 'chrome', testIgnore: /sweep/, use: {channel: 'chrome'}},
    {name: 'sweep-chrome', testMatch: /sweep/, use: {channel: 'chrome'}},
    {name: 'sweep-webkit', testMatch: /sweep/, use: {...devices['Desktop Safari']}},
  ],
  webServer: {command: `npx --yes serve@14 -s ${DIST} -l ${PORT}`, port: PORT, reuseExistingServer: !!process.env.PERF_REUSE_SERVER},
})
