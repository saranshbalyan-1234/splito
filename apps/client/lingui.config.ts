// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - lingui.config.ts
import {defineConfig} from '@lingui/cli'

export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'hi'],
  catalogs: [
    {
      path: '<rootDir>/src/locale/locales/{locale}/messages',
      include: ['src'],
    },
  ],
  format: 'po',
  // Compiled catalogs are TypeScript modules, as upstream.
  compileNamespace: 'ts',
  // A Hindi string without a translation renders its English source, never its id.
  fallbackLocales: {default: 'en'},
})
