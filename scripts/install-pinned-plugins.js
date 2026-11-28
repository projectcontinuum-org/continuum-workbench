#!/usr/bin/env node
'use strict';
/**
 * Installs the plugins whose release is pinned by checksum (`pluginChecksums` in the application's package.json) and
 * refuses a download whose SHA-256 differs. `theia download:plugins` does not verify anything and skips a plugin that
 * is already on disk, so this runs first (see the `download:plugins` script) and leaves a verified plugin directory
 * that Theia then skips. Plugins without a pinned checksum are left to Theia.
 *
 * Usage (from the application directory): node ../scripts/install-pinned-plugins.js
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const MARKER_FILE = '.continuum-sha256';

function sha256Of(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

/** Throws unless the buffer's SHA-256 equals the pinned one. */
function assertChecksum(pluginId, buffer, expected) {
    const actual = sha256Of(buffer);
    if (actual !== expected) {
        throw new Error(`checksum mismatch for ${pluginId}: expected ${expected}, got ${actual}`);
    }
}

/** Whether the plugin directory was installed by this script from a file with the pinned checksum. */
function isVerifiedInstall(pluginDirectory, expected) {
    try {
        return fs.readFileSync(path.join(pluginDirectory, MARKER_FILE), 'utf8').trim() === expected;
    } catch {
        return false;
    }
}

async function install(pluginId, url, expected, pluginsDirectory) {
    const target = path.join(pluginsDirectory, pluginId);
    if (isVerifiedInstall(target, expected)) {
        console.log(`- ${pluginId}: verified install present - skipping`);
        return;
    }
    console.log(`- ${pluginId}: downloading ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`${pluginId}: download failed with status ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    assertChecksum(pluginId, buffer, expected);
    const decompress = require('decompress');
    fs.rmSync(target, { recursive: true, force: true });
    await decompress(buffer, target);
    fs.writeFileSync(path.join(target, MARKER_FILE), `${expected}\n`);
    console.log(`+ ${pluginId}: installed, checksum verified`);
}

async function main() {
    const application = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
    const pluginsDirectory = path.resolve(application.theiaPluginsDir || 'plugins');
    const checksums = application.pluginChecksums || {};
    fs.mkdirSync(pluginsDirectory, { recursive: true });
    for (const [pluginId, expected] of Object.entries(checksums)) {
        const url = (application.theiaPlugins || {})[pluginId];
        if (!url) {
            throw new Error(`${pluginId} has a pinned checksum but no entry in theiaPlugins`);
        }
        await install(pluginId, url, expected, pluginsDirectory);
    }
}

module.exports = { sha256Of, assertChecksum, isVerifiedInstall, MARKER_FILE };

if (require.main === module) {
    main().catch(error => {
        console.error(`install-pinned-plugins: ${error.message}`);
        process.exit(1);
    });
}
