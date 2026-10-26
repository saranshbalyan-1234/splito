// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - metro.config.ts
const {getDefaultConfig} = require('expo/metro-config')
const {getBundleModeMetroConfig} = require('react-native-worklets/bundleMode/index.js')
const path = require('node:path')

const config = getDefaultConfig(__dirname)
config.watchFolders = [path.resolve(__dirname, '../..')]
config.resolver.assetExts = [...config.resolver.assetExts, 'woff2', 'lottie']

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && /^react-native-gesture-handler(\/|$)/.test(moduleName)) {
    throw new Error(`react-native-gesture-handler must not be imported on web (requested from ${context.originModulePath})`)
  }
  return context.resolveRequest(context, moduleName, platform)
}

config.transformer.getTransformOptions = async () => ({
  transform: {experimentalImportSupport: true, inlineRequires: true},
})

module.exports = getBundleModeMetroConfig(config)
