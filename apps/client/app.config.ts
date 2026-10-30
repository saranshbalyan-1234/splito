import {type ExpoConfig} from 'expo/config'

import linkHosts from './link-hosts.json'
import {assertAuthConfig} from './auth-config'
import {tierFrom} from './link-tier'

type Tier = keyof typeof linkHosts.tiers

/*
 * The version comes from package.json here and reaches the app as an inlined env value, so no bundle
 * carries the whole package.json (its dependency list included).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {version} = require('./package.json') as {version: string}
process.env.EXPO_PUBLIC_RELEASE_VERSION ||= version

/*
 * Brand assets are generated from assets-owner/logo-owner-provided.svg by
 * `pnpm brand` (scripts/brand.ts) - edit the script, not the PNGs.
 */
/* ALF Dim's `atoms.bg` (src/alf/splash.test.ts keeps this and public/index.html in step). */
const DIM_BACKGROUND = '#151D28'
const SPLASH = {
  light: {image: './assets/brand/splash-mark.png', backgroundColor: '#FFFFFF'},
  dark: {
    image: './assets/brand/splash-mark-dark.png',
    backgroundColor: DIM_BACKGROUND,
  },
}

/**
 * Universal Links and App Links (F-254, ARCHITECTURE 14): a build claims only its own tier's host, so a dev build
 * never opens prod links. Hosts and the claimed paths come from `link-hosts.json`, the one file the resolver
 * (`src/lib/links`) reads too; `src/lib/links/appConfig.test.ts` checks every tier claims exactly its host.
 */
export function linkClaims(tier: Tier) {
  const host = linkHosts.tiers[tier]
  return {
    ios: {associatedDomains: [`applinks:${host}`]},
    android: {
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          /* "/" is the Home page alone (a prefix of it would claim every path, downloads and callbacks included). */
          data: linkHosts.appPaths.map(p => (p === '/' ? {scheme: 'https', host, path: '/'} : {scheme: 'https', host, pathPrefix: p})),
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
  }
}

const TIER = tierFrom(process.env.EXPO_PUBLIC_TIER)
/* A release build without the real auth API does not build (production has no dev sign-in, F-250). */
assertAuthConfig(process.env)

const config: ExpoConfig = {
  name: 'Splito',
  slug: 'splito',
  scheme: linkHosts.scheme,
  version,
  orientation: 'default',
  userInterfaceStyle: 'automatic',
  icon: './assets/brand/icon.png',
  ios: {
    bundleIdentifier: 'app.splito',
    supportsTablet: true,
    ...linkClaims(TIER).ios,
    icon: {
      light: './assets/brand/icon.png',
      dark: './assets/brand/icon-dark.png',
      tinted: './assets/brand/icon-tinted.png',
    },
  },
  android: {
    package: 'app.splito',
    ...linkClaims(TIER).android,
    adaptiveIcon: {
      foregroundImage: './assets/brand/adaptive-foreground.png',
      backgroundImage: './assets/brand/adaptive-background.png',
      monochromeImage: './assets/brand/adaptive-monochrome.png',
      backgroundColor: '#006AFF',
    },
  },
  /* public/index.html carries theme-color (light and dark) and public/manifest.json the PWA fields; `favicon` adds /favicon.ico. */
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/brand/favicon.png',
    name: 'Splito',
    shortName: 'Splito',
  },
  plugins: [
    'expo-sqlite',
    /* Local reminders (F-1907, F-1119): scheduled on the device, no push token and no server. The permission is asked only by Splito's own primer. */
    ['expo-notifications', {color: '#006AFF'}],
    /* Adapted from bluesky-social/social-app@4e4ad9c (MIT) - app.config.js. The shell's SystemBars sets the bar icon colours per theme. */
    [
      'react-native-edge-to-edge',
      {android: {enforceNavigationBarContrast: false}},
    ],
    /* Adapted from bluesky-social/social-app@4e4ad9c (MIT) - app.config.js (expo-contacts). Asked only after Splito's primer (26.18, F-216). */
    [
      'expo-contacts',
      {
        contactsPermission:
          'Splito opens your contacts so you can pick a friend to add. Only the email or number you choose is used.',
      },
    ],
    /* Adapted from bluesky-social/social-app@4e4ad9c (MIT) - app.config.js. Building React Native from
       source is what Bluesky ships; the prebuilt binaries hide headers its native modules import (RCTBridge.h). */
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '16.4',
          buildReactNativeFromSource: true,
          cxxLanguageStandard: 'c++23',
        },
        android: {
          compileSdkVersion: 37,
          targetSdkVersion: 36,
          buildToolsVersion: '37.0.0',
          buildReactNativeFromSource: true,
          enableMinifyInReleaseBuilds: true,
        },
      },
    ],
    [
      'expo-splash-screen',
      {
        ...SPLASH.light,
        /* The image has transparent padding so the mark fits Android 12's circular icon mask; 200 dp shows it at about 100 dp. */
        imageWidth: 200,
        resizeMode: 'contain',
        dark: SPLASH.dark,
      },
    ],
    [
      'expo-font',
      {
        fonts: [
          './assets/fonts/inter/InterVariable.ttf',
          './assets/fonts/inter/InterVariable-Italic.ttf',
        ],
      },
    ],
  ],
}

export default config
