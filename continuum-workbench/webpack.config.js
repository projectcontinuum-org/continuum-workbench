/**
 * This file can be edited to customize webpack configuration.
 * To reset delete this file and rerun theia build again.
 */
// @ts-nocheck
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const configs = require('./gen-webpack.config.js');
const nodeConfig = require('./gen-webpack.node.config.js');

// --- Continuum White-Label Customizations ---

// 1. Copy Continuum branding assets (favicon, logo) to output
// 2. Transform secondary-window.html to replace "Theia" with "Continuum"
configs[0].plugins.push(
    new CopyWebpackPlugin({
        patterns: [
            { from: path.resolve(__dirname, 'resources/favicon.svg'), to: '.' },
            { from: path.resolve(__dirname, 'resources/Logo.png'), to: '.' },
            {
                from: path.resolve(__dirname, 'src-gen/frontend/secondary-window.html'),
                to: 'secondary-window.html',
                transform(content) {
                    return content.toString().replace('Theia — Secondary Window', 'Continuum');
                },
                force: true // overwrite the copy from gen-webpack.config.js
            }
        ]
    })
);

module.exports = [
    ...configs,
    nodeConfig.config,
];
