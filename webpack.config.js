const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const appDirectory = path.resolve(__dirname);
const { presets, plugins } = require(`${appDirectory}/babel.config.js`);
const compileNodeModules = [
    // Add every react-native package that needs compiling
    // 'react-native-gesture-handler',
].map((moduleName) => path.resolve(appDirectory, `node_modules/${moduleName}`));

const babelLoaderConfiguration = {
    test: /\.(js|jsx|ts|tsx)$/, // Updated to include .jsx
    // Add every directory that needs to be compiled by Babel during the build.
    include: [
        path.resolve(__dirname, "index.web.js"), // Entry to your application
        path.resolve(__dirname, "App.tsx"), // Updated to .jsx
        path.resolve(__dirname, "src"),
        path.resolve(__dirname, "component"),
        ...compileNodeModules,
    ],
    use: {
        loader: "babel-loader",
        options: {
            cacheDirectory: true,
            presets,
            plugins,
        },
    },
};

const svgLoaderConfiguration = {
    test: /\.svg$/,
    use: [
        {
            loader: "@svgr/webpack",
        },
    ],
};

const imageLoaderConfiguration = {
    test: /\.(gif|jpe?g|png|svg)$/,
    use: {
        loader: "url-loader",
        options: {
            name: "[name].[ext]",
        },
    },
};

const tsLoaderConfiguration = {
    test: /\.(ts)x?$/,
    exclude: /node_modules|\.d\.ts$/, // this line as well
    use: {
        loader: "ts-loader",
        options: {
            compilerOptions: {
                noEmit: false, // this option will solve the issue
            },
        },
    },
};

module.exports = {
    entry: {
        app: path.join(__dirname, "index.web.js"),
    },
    output: {
        path: path.resolve(appDirectory, "dist"),
        publicPath: "/",
        filename: "rnw.bundle.js",
    },
    resolve: {
        alias: {
            'react-native-config': 'react-web-config',
            'react-native$': 'react-native-web',
            'react-native-sound': 'react-native-web-sound',
            // Module alias for web & desktop
            // https://webpack.js.org/configuration/resolve/#resolvealias
            '@assets': path.resolve(__dirname, '../../assets'),
            '@components': path.resolve(__dirname, '../../src/components/'),
            '@hooks': path.resolve(__dirname, '../../src/hooks/'),
            '@libs': path.resolve(__dirname, '../../src/libs/'),
            // '@navigation': path.resolve(__dirname, '../../src/libs/Navigation/'),
            '@pages': path.resolve(__dirname, '../../src/pages/'),
            '@styles': path.resolve(__dirname, '../../src/styles/'),
            // This path is provide alias for files like `ONYXKEYS` and `CONST`.
            '@src': path.resolve(__dirname, '../../src/'),
            // '@userActions': path.resolve(__dirname, '../../src/libs/actions/'),
        },

        // React Native libraries may have web-specific module implementations that appear with the extension `.web.js`
        // without this, web will try to use native implementations and break in not very obvious ways.
        // This is also why we have to use .website.js for our own web-specific files...
        // Because desktop also relies on "web-specific" module implementations
        // This also skips packing web only dependencies to desktop and vice versa
        extensions: [
            '.web.js',
            '.website.js',
            '.js',
            '.jsx',
            '.web.ts',
            '.website.ts',
            '.website.tsx',
            '.ts',
            '.web.tsx',
            '.tsx',
            '.desktop.ts',
            '.desktop.js',
            '.desktop.tsx',
        ],
        // fallback: {
        //     'process/browser': require.resolve('process/browser'),
        //     crypto: false,
        // },
    },
    module: {
        rules: [babelLoaderConfiguration, imageLoaderConfiguration, svgLoaderConfiguration, tsLoaderConfiguration],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: path.join(__dirname, "index.html"),
        }),
        new webpack.HotModuleReplacementPlugin(),
        new webpack.DefinePlugin({
            __DEV__: JSON.stringify(true),
        }),
    ],
};
