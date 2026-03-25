/**
 * This file can be edited to customize webpack configuration.
 * To reset delete this file and rerun theia build again.
 */
// @ts-check
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const configs = require('./gen-webpack.config.js');

// --- Continuum White-Label Customizations ---

// Copy Continuum branding assets (favicon, logo) to output
configs[0].plugins.push(
    new CopyWebpackPlugin({
        patterns: [
            { from: path.resolve(__dirname, 'resources/favicon.svg'), to: '.' },
            { from: path.resolve(__dirname, 'resources/Logo.png'), to: '.' },
        ]
    })
);

module.exports = configs;
