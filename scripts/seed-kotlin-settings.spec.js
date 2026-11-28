'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');

const seedScript = require('./seed-kotlin-settings.js');
const pinnedPlugins = require('./install-pinned-plugins.js');
const application = require('../continuum-workbench/package.json');

const environment = (env, existing = []) => ({ env, exists: file => existing.includes(file), developmentDirectory: '/repo/.kotlin-ls' });

function runSeed(configDirectory) {
    return spawnSync(process.execPath, [path.join(__dirname, 'seed-kotlin-settings.js')], {
        env: { PATH: process.env.PATH ?? '', THEIA_CONFIG_DIR: configDirectory, CONTINUUM_KOTLIN_LS_HOME: '/opt/continuum/kotlin-ls' }
    });
}

function withConfigDirectory(body) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kotlin-seed-'));
    try {
        body(directory);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
}

describe('the Kotlin extension pin', () => {
    it('downloads release 0.2.36 from Open VSX with a pinned checksum, installed before Theia downloads anything', () => {
        assert.equal(application.theiaPlugins['fwcd.kotlin'], 'https://open-vsx.org/api/fwcd/kotlin/0.2.36/file/fwcd.kotlin-0.2.36.vsix');
        assert.equal(application.pluginChecksums['fwcd.kotlin'], '79be50d4de08f29e0fabe30e9ee094eb86ce5eeae28bdd02bcc6dc6593453a2d');
        assert.match(application.scripts['download:plugins'], /^node \.\.\/scripts\/install-pinned-plugins\.js && theia download:plugins/);
    });

    it('rejects content whose checksum differs and accepts the pinned one', () => {
        const content = Buffer.from('plugin bytes');
        assert.doesNotThrow(() => pinnedPlugins.assertChecksum('x', content, pinnedPlugins.sha256Of(content)));
        assert.throws(() => pinnedPlugins.assertChecksum('x', content, '0'.repeat(64)), /checksum mismatch/);
    });
});

describe('the seeded settings', () => {
    it('point at the bundled server and runtime, switch downloads off and hide the script folder', () => {
        const settings = seedScript.kotlinSettings(environment({ CONTINUUM_KOTLIN_LS_HOME: '/opt/continuum/kotlin-ls', CONTINUUM_JAVA_HOME: '/opt/continuum/kotlin-ls/jre' }));
        assert.deepEqual(settings, {
            'kotlin.languageServer.enabled': true,
            'kotlin.languageServer.path': '/opt/continuum/kotlin-ls/bin/kotlin-language-server',
            'kotlin.java.home': '/opt/continuum/kotlin-ls/jre',
            'kotlin.java.opts': seedScript.SERVER_JAVA_OPTIONS,
            'kotlin.scripts.enabled': true,
            'kotlin.debugAdapter.enabled': false,
            'files.exclude': { '.continuum-scripts': true },
            'search.exclude': { '.continuum-scripts': true }
        });
    });

    it('leave the runtime to the user outside the image when there is none to point at', () => {
        const settings = seedScript.kotlinSettings(environment({}));
        assert.equal(settings['kotlin.languageServer.path'], '/repo/.kotlin-ls/bin/kotlin-language-server');
        assert.equal('kotlin.java.home' in settings, false);
    });

    it('keep user settings and user-set defaults, rewrite the install paths', () => {
        const merged = JSON.parse(seedScript.mergeSettings(
            '{"editor.fontSize": 14, "kotlin.scripts.enabled": false, "kotlin.languageServer.path": "/old"}',
            { 'kotlin.scripts.enabled': true, 'kotlin.languageServer.path': '/new' }
        ));
        assert.deepEqual(merged, {
            'editor.fontSize': 14,
            'kotlin.scripts.enabled': false,
            'kotlin.languageServer.path': '/new'
        });
    });

    it('add the script folder to the user\'s excludes without dropping their entries or overriding a user false', () => {
        const seeded = { 'files.exclude': { '.continuum-scripts': true }, 'search.exclude': { '.continuum-scripts': true } };
        const merged = JSON.parse(seedScript.mergeSettings(
            '{"files.exclude": {"**/.git": true}, "search.exclude": {".continuum-scripts": false}}', seeded
        ));
        assert.deepEqual(merged['files.exclude'], { '.continuum-scripts': true, '**/.git': true });
        assert.deepEqual(merged['search.exclude'], { '.continuum-scripts': false });
    });

    it('are idempotent', () => {
        const seeded = seedScript.kotlinSettings(environment({}));
        const once = seedScript.mergeSettings('{}', seeded);
        assert.equal(seedScript.mergeSettings(once, seeded), once);
    });

    it('read settings with comments, trailing commas and a byte order mark without losing a key', () => {
        const text = '\uFEFF{\n // my font\n "editor.fontSize": 14, /* url */ "x": "http://a//b",\n "list": [1, 2,],\n}';
        const merged = JSON.parse(seedScript.mergeSettings(text, { 'kotlin.java.home': '/j' }));
        assert.deepEqual(merged, { 'editor.fontSize': 14, x: 'http://a//b', list: [1, 2], 'kotlin.java.home': '/j' });
    });

    it('leave a settings file that is not a JSON object alone', () => {
        assert.equal(seedScript.mergeSettings('{ nope', { a: 1 }), undefined);
        assert.equal(seedScript.mergeSettings('[1]', { a: 1 }), undefined);
    });
});

describe('the seeded script folder', () => {
    it('is the folder the editor writes its temp files to', () => {
        const layout = fs.readFileSync(path.join(__dirname, '../workflow-editor-extension/src/common/script-editor/ScriptFolderLayout.ts'), 'utf8');
        const folder = /SCRIPTS_FOLDER\s*=\s*'([^']+)'/.exec(layout)?.[1];
        assert.ok(folder, 'ScriptFolderLayout declares the folder');
        assert.deepEqual(Object.keys(seedScript.kotlinSettings(environment({}))['files.exclude']), [folder]);
    });
});

describe('the seed script', () => {
    it('writes the settings and the extension first-run marker, and creates settings.json on a first start', () => {
        withConfigDirectory(directory => {
            const result = runSeed(directory);
            assert.equal(result.status, 0, String(result.stderr));
            const settings = JSON.parse(fs.readFileSync(path.join(directory, 'settings.json'), 'utf8'));
            assert.equal('security.workspace.trust.enabled' in settings, false, 'the user decides on workspace trust');
            const marker = JSON.parse(fs.readFileSync(path.join(directory, 'globalStorage', 'fwcd.kotlin', 'config.json'), 'utf8'));
            assert.deepEqual(marker, { initialized: true });
        });
    });

    it('backs up a commented settings file once and leaves no temporary file', () => {
        withConfigDirectory(directory => {
            const original = '{\n // keep me\n "editor.fontSize": 14,\n}';
            fs.writeFileSync(path.join(directory, 'settings.json'), original);
            assert.equal(runSeed(directory).status, 0);
            assert.equal(fs.readFileSync(path.join(directory, 'settings.json.continuum-backup'), 'utf8'), original);
            assert.deepEqual(fs.readdirSync(directory).filter(name => name.endsWith('.tmp')), []);
        });
    });

    it('fails and writes nothing when settings.json is invalid', () => {
        withConfigDirectory(directory => {
            fs.writeFileSync(path.join(directory, 'settings.json'), '{ broken');
            const result = runSeed(directory);
            assert.equal(result.status, 1);
            assert.match(String(result.stderr), /not valid JSON/);
            assert.equal(fs.readFileSync(path.join(directory, 'settings.json'), 'utf8'), '{ broken');
            assert.equal(fs.existsSync(path.join(directory, 'globalStorage')), false);
        });
    });

    it('defaults to the configuration folder the application reads, and THEIA_CONFIG_DIR overrides it', () => {
        assert.equal(seedScript.CONFIGURATION_FOLDER, application.theia.backend.config.configurationFolder);
        assert.equal(seedScript.resolveConfigDirectory({}, '/home/someone'), '/home/someone/.continuum');
        assert.equal(seedScript.resolveConfigDirectory({ THEIA_CONFIG_DIR: '/custom' }, '/home/someone'), '/custom');
    });
});
