import {type ExpoConfig} from 'expo/config'

const config: ExpoConfig = {
  name: 'Splito',
  slug: 'splito',
  scheme: 'splito',
  version: '0.1.0',
  orientation: 'default',
  userInterfaceStyle: 'automatic',
  icon: './assets/brand/icon.png',
  ios: {bundleIdentifier: 'app.splito', supportsTablet: true},
  android: {
    package: 'app.splito',
    adaptiveIcon: {foregroundImage: './assets/brand/adaptive-foreground.png', monochromeImage: './assets/brand/adaptive-monochrome.png', backgroundColor: '#0F9D76'},
  },
  web: {bundler: 'metro', output: 'single', favicon: './assets/brand/favicon.png', name: 'Splito', shortName: 'Splito', themeColor: '#0F9D76', backgroundColor: '#FFFFFF'},
  plugins: [
    'expo-sqlite',
    ['expo-splash-screen', {image: './assets/brand/splash-mark.png', imageWidth: 160, backgroundColor: '#0F9D76', dark: {backgroundColor: '#032A21'}}],
    ['expo-font', {fonts: ['./assets/fonts/inter/InterVariable.ttf', './assets/fonts/inter/InterVariable-Italic.ttf']}],
  ],
}

export default config
