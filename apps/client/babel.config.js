// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - babel.config.js
/**
 * React Compiler tags generated nodes with loc = Symbol(GeneratedSource),
 * which breaks the structuredClone Metro performs on the AST when
 * EXPO_UNSTABLE_TREE_SHAKING is enabled. Strip them after all other
 * transforms have run.
 *
 * @returns {import('@babel/core').PluginObj}
 */
const stripSymbolLocs = () => ({
  post(file) {
    file.path.traverse({
      enter(path) {
        if (typeof path.node.loc === 'symbol') {
          path.node.loc = undefined
        }
      },
    })
    if (typeof file.ast.program.loc === 'symbol') {
      file.ast.program.loc = undefined
    }
  },
})

/**
 * @param {import("@babel/core").ConfigAPI} api
 * @returns {import("@babel/core").InputOptions}
 */
module.exports = function (api) {
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          lazyImports: true,
          native: {
            // Metro handles ESM -> CJS; Jest runs without Metro.
            disableImportExportTransform: !api.env('test'),
          },
        },
      ],
    ],
    plugins: [
      // Production bundles carry message ids only; src/locale/i18n.ts loads the compiled catalogs.
      '@lingui/babel-plugin-lingui-macro',
      ['babel-plugin-react-compiler', {target: '19'}],
      [
        'module-resolver',
        {
          alias: {
            // Mirrored in tsconfig.json
            '#': './src',
          },
        },
      ],
      stripSymbolLocs,
      ['react-native-worklets/plugin', {bundleMode: true, strictGlobal: true}], // must be last
    ],
  }
}
