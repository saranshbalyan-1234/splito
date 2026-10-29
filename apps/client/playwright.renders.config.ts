import {defineConfig} from '@playwright/test'

/*
 * The wasted-render gate (ARCHITECTURE 17, owner 108): runs the scenario on the
 * DEV web bundle (Metro dev server, why-did-you-render loaded) in the e2e
 * environment so the demo hook exists. A dev server rather than `expo export
 * --dev`: that export names async chunks by file name with one shared hash, and
 * `demoMode.ts` / `DemoMode.tsx` overwrite each other on a case-insensitive disk.
 * Own port (never the e2e or perf ones); one worker so counts are quiet.
 */
const PORT = Number(process.env.RENDERS_PORT ?? 8191)

export default defineConfig({
  testDir: 'e2e-renders',
  timeout: 300_000,
  workers: 1,
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    trace: 'retain-on-failure',
    actionTimeout: 20_000,
  },
  webServer: {
    command: `CI=1 EXPO_NO_TELEMETRY=1 EXPO_PUBLIC_ENV=e2e npx expo start --web --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 300_000,
    reuseExistingServer: false,
  },
})
