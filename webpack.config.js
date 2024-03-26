const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const appDirectory = path.resolve(__dirname);
const { presets, plugins } = require(`${appDirectory}/babel.config.js`);
const compileNodeModules = [
    // Add every react-native package that needs compiling
    // 'react-native-gesture-handler',
].map((moduleName) => path.resolve(appDirectory, `node_modules/${moduleName}`));

const includeModules = ["react-native-elements","react-native-vector-icons"].join("|")

const babelLoaderConfiguration = {
    test: /\.(js|jsx|ts|tsx)$/, // Updated to include .jsx
    // Add every directory that needs to be compiled by Babel during the build.
    // include: [
    //     path.resolve(__dirname, "index.web.js"), // Entry to your application
    //     path.resolve(__dirname, "App.tsx"), // Updated to .jsx
    //     path.resolve(__dirname, "src"),
    //     path.resolve(__dirname, "component"),
    //     ...compileNodeModules,
    // ],
     exclude: [new RegExp(`node_modules/(?!(${includeModules})/).*|.native.js$`)],
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

const assetConfiguration = {
    test: /\.(png|jpe?g|gif)$/i,
    type: "asset",
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

const cssLoaderConfiguration = {
    test: /\.css$/i,
    use: ["style-loader", "css-loader"],
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
        extensions: [".web.tsx", ".web.ts", ".tsx", ".ts", ".web.js", ".js"],
        alias: {
            "react-native$": "react-native-web",
        },
    },
    module: {
        rules: [babelLoaderConfiguration, cssLoaderConfiguration, imageLoaderConfiguration, svgLoaderConfiguration, tsLoaderConfiguration, assetConfiguration],
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
