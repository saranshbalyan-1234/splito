import {type ExpoConfig} from 'expo/config'

/*
 * Brand assets are generated from assets-owner/logo-owner-provided.svg by
 * `pnpm brand` (scripts/brand.ts) - edit the script, not the PNGs.
 */
const SPLASH = {
  light: {image: './assets/brand/splash-mark.png', backgroundColor: '#FFFFFF'},
  dark: {
    image: './assets/brand/splash-mark-dark.png',
    backgroundColor: '#000000',
  },
}

const config: ExpoConfig = {
  name: 'Splito',
  slug: 'splito',
  scheme: 'splito',
  version: '0.1.0',
  orientation: 'default',
  userInterfaceStyle: 'automatic',
  icon: './assets/brand/icon.png',
  ios: {
    bundleIdentifier: 'app.splito',
    supportsTablet: true,
    icon: {
      light: './assets/brand/icon.png',
      dark: './assets/brand/icon-dark.png',
      tinted: './assets/brand/icon-tinted.png',
    },
  },
  android: {
    package: 'app.splito',
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
    /* Adapted from bluesky-social/social-app@4e4ad9c (MIT) - app.config.js. The shell's SystemBars sets the bar icon colours per theme. */
    ['react-native-edge-to-edge', {android: {enforceNavigationBarContrast: false}}],
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
        ios: {deploymentTarget: '16.4', buildReactNativeFromSource: true, cxxLanguageStandard: 'c++23'},
        android: {compileSdkVersion: 37, targetSdkVersion: 36, buildToolsVersion: '37.0.0', buildReactNativeFromSource: true, enableMinifyInReleaseBuilds: true},
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
