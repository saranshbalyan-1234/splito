import {type ExpoConfig} from 'expo/config'

/*
 * Brand assets are generated from assets/brand/mark*.svg by
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
