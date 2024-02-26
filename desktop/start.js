#!/usr/bin/env node
const portfinder = require('portfinder');
const concurrently = require('concurrently');
require('dotenv').config();

const basePort = 8082;

portfinder
    .getPortPromise({
        port: basePort,
    })
    .then((port) => {
        const devServer = `webpack-dev-server --config webpack.config.js --port ${port} --env platform=desktop`;
        const buildMain = 'webpack watch --config webpack.desktop.js --config-name desktop-main --mode=development';

        const env = {
            PORT: port,
            NODE_ENV: 'development',
        };

        const processes = [
            {
                command: buildMain,
                name: 'Main',
                prefixColor: 'blue.dim',
                env,
            },
            {
                command: devServer,
                name: 'Renderer',
                prefixColor: 'red.dim',
                env,
            },
            {
                command: `npx electronmon ./desktop/dev.js`,
                name: 'Electron',
                prefixColor: 'cyan.dim',
                env,
            },
        ];
        return concurrently(processes, {
            inputStream: process.stdin,
            prefix: 'name',

            // Like Harry Potter and he-who-must-not-be-named, "neither can live while the other survives"
            killOthers: ['success', 'failure'],
        })
    })
    .catch((e) => {
        console.log(e)
        process.exit(1)
    });
