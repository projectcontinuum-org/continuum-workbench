const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

/**
 * Every Theia package must be one exact, shared version. A range such as "latest" lets one install resolve some Theia
 * packages to a newer release than the rest, which breaks the app at boot (two copies of the core, a CLI that
 * generates a different build than the runtime expects).
 */
const root = path.resolve(__dirname, '..');
const PACKAGE_FILES = [
    'continuum-workbench/package.json',
    'continuum-workbench-thin/package.json',
    'workflow-editor-extension/package.json',
    'workflow-builder-extension/package.json'
];
const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

function theiaDependencies(file) {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    const all = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
    return Object.entries(all).filter(([name]) => name.startsWith('@theia/'));
}

function lockedVersions(lockText, packageName) {
    const versions = new Set();
    const header = new RegExp(`^"?${packageName.replace('/', '\\/')}@[^\\n]*:\\n\\s+version "([^"]+)"`, 'gm');
    for (const match of lockText.matchAll(header)) {
        versions.add(match[1]);
    }
    return versions;
}

test('every @theia/* dependency in every workbench package is an exact version', () => {
    for (const file of PACKAGE_FILES) {
        for (const [name, range] of theiaDependencies(file)) {
            assert.match(range, EXACT_VERSION, `${file}: ${name} is "${range}", expected an exact version`);
        }
    }
});

test('all @theia/* dependencies share one version', () => {
    const versions = new Set(PACKAGE_FILES.flatMap(file => theiaDependencies(file).map(([, range]) => range)));
    assert.strictEqual(versions.size, 1, `found several Theia versions: ${[...versions].join(', ')}`);
});

test('yarn.lock holds exactly one version of every @theia/* package', () => {
    const lockText = fs.readFileSync(path.join(root, 'yarn.lock'), 'utf8');
    const names = new Set([...lockText.matchAll(/^"?(@theia\/[a-z0-9-]+)@/gm)].map(match => match[1]));
    assert.ok(names.has('@theia/core'), 'the lockfile should contain @theia/core');
    for (const name of names) {
        if (name === '@theia/monaco-editor-core') {
            continue; // versioned independently of the framework (it tracks the Monaco release)
        }
        const versions = lockedVersions(lockText, name);
        assert.strictEqual(versions.size, 1, `${name} is locked at ${[...versions].join(', ')}`);
    }
    const expected = [...new Set(PACKAGE_FILES.flatMap(file => theiaDependencies(file).map(([, range]) => range)))][0];
    assert.deepStrictEqual([...lockedVersions(lockText, '@theia/core')], [expected]);
});
