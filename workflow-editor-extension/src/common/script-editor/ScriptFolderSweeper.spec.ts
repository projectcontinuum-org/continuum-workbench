import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FakeFileSystem } from './FakeFileSystem.testing';
import { LEASE_EXPIRY_MS } from './ScriptFolderLayout';
import { ScriptFolderSweeper } from './ScriptFolderSweeper';

const ROOT = 'file:///work';
const NOW = 5_000_000;
const id = (suffix: string): string => `ctx${suffix.padEnd(16, '0')}`;
const STALE = id('stale');
const FRESH = id('fresh');
const NO_LEASE = id('nolease');

function setup() {
    const files = new FakeFileSystem();
    const warnings: string[] = [];
    files.files.set(`${ROOT}/.continuum-scripts/.gitignore`, '*\n');
    files.files.set(`${ROOT}/.continuum-scripts/${STALE}/.lease`, String(NOW - LEASE_EXPIRY_MS - 10));
    files.files.set(`${ROOT}/.continuum-scripts/${STALE}/Script.kt`, 'x');
    files.files.set(`${ROOT}/.continuum-scripts/${FRESH}/.lease`, String(NOW - 5000));
    files.files.set(`${ROOT}/.continuum-scripts/${FRESH}/Script.kt`, 'y');
    files.files.set(`${ROOT}/.continuum-scripts/${NO_LEASE}/Script.kt`, 'z');
    files.files.set(`${ROOT}/.continuum-scripts/notes/readme.txt`, 'keep');
    return { files, warnings, sweeper: new ScriptFolderSweeper(files, () => NOW, message => warnings.push(message)) };
}

describe('the startup sweep', () => {
    it('deletes folders with a stale or missing lease and keeps live ones and foreign entries', async () => {
        const { files, sweeper } = setup();
        assert.equal(await sweeper.sweep(ROOT), 2);
        assert.equal(await files.exists(`${ROOT}/.continuum-scripts/${STALE}`), false);
        assert.equal(await files.exists(`${ROOT}/.continuum-scripts/${NO_LEASE}`), false);
        assert.equal(await files.exists(`${ROOT}/.continuum-scripts/${FRESH}`), true);
        assert.equal(await files.exists(`${ROOT}/.continuum-scripts/notes`), true);
        assert.equal(await files.exists(`${ROOT}/.continuum-scripts/.gitignore`), true);
    });

    it('does nothing and does not throw without a workspace or without the hidden folder', async () => {
        const { sweeper } = setup();
        assert.equal(await sweeper.sweep(undefined), 0);
        assert.equal(await new ScriptFolderSweeper(new FakeFileSystem(), () => NOW).sweep(ROOT), 0);
    });

    it('never throws when the file system fails, and says so once', async () => {
        const { files, warnings, sweeper } = setup();
        files.failDeletes = true;
        assert.equal(await sweeper.sweep(ROOT), 0);
        assert.ok(warnings.length >= 1);
        files.list = async () => {
            throw new Error('offline');
        };
        assert.equal(await sweeper.sweep(ROOT), 0);
    });

    it('keeps a lease exactly at the expiry time', async () => {
        const { files, sweeper } = setup();
        files.files.set(`${ROOT}/.continuum-scripts/${FRESH}/.lease`, String(NOW - LEASE_EXPIRY_MS));
        await sweeper.sweep(ROOT);
        assert.equal(await files.exists(`${ROOT}/.continuum-scripts/${FRESH}`), true);
    });

    it('does not sweep through a hidden folder that is a symbolic link, nor remove a folder that is one', async () => {
        const { files, sweeper } = setup();
        files.symlinks.add(`${ROOT}/.continuum-scripts/${STALE}`);
        assert.equal(await sweeper.sweep(ROOT), 1);
        assert.equal(await files.exists(`${ROOT}/.continuum-scripts/${STALE}`), true);
        files.symlinks.add(`${ROOT}/.continuum-scripts`);
        files.files.set(`${ROOT}/.continuum-scripts/${id('another')}/Script.kt`, 'q');
        assert.equal(await sweeper.sweep(ROOT), 0);
        assert.equal(await files.exists(`${ROOT}/.continuum-scripts/${id('another')}`), true);
    });
});
