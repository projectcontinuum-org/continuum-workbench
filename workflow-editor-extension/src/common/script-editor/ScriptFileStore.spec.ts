import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FakeFileSystem } from './FakeFileSystem.testing';
import { ScriptFileStore, Timers } from './ScriptFileStore';
import { LEASE_RENEW_MS } from './ScriptFolderLayout';

const ROOT = 'file:///work';
const REQUEST = { packageId: 'ctxone', scriptText: 'package ctxone\nfun script() {}', declarationsText: 'package ctxone\n' };

class FakeTimers implements Timers {
    time = 1000;
    callbacks = new Map<number, () => void>();
    private next = 1;
    now(): number {
        return this.time;
    }
    setInterval(callback: () => void): unknown {
        const handle = this.next++;
        this.callbacks.set(handle, callback);
        return handle;
    }
    clearInterval(handle: unknown): void {
        this.callbacks.delete(handle as number);
    }
    tick(milliseconds: number): void {
        this.time += milliseconds;
        [...this.callbacks.values()].forEach(callback => callback());
    }
}

function setup(root: string | undefined = ROOT, hasRoot = true) {
    const files = new FakeFileSystem();
    const timers = new FakeTimers();
    const warnings: string[] = [];
    const store = new ScriptFileStore(files, () => (hasRoot ? root : undefined), timers, message => warnings.push(message));
    return { files, timers, warnings, store };
}

describe('the script file store', () => {
    it('writes the script, the declarations and a lease into its own folder of the workspace', async () => {
        const { files, store } = setup();
        const opened = await store.open(REQUEST);
        assert.equal(opened?.scriptUri, `${ROOT}/.continuum-scripts/ctxone/Script.kt`);
        assert.equal(files.files.get(`${ROOT}/.continuum-scripts/ctxone/Script.kt`), REQUEST.scriptText);
        assert.equal(files.files.get(`${ROOT}/.continuum-scripts/ctxone/ScriptFlowVariables.kt`), REQUEST.declarationsText);
        assert.equal(files.files.get(`${ROOT}/.continuum-scripts/ctxone/.lease`), '1000');
    });

    it('writes the ignore-everything file once and does not rewrite an existing one', async () => {
        const { files, store } = setup();
        await store.open(REQUEST);
        assert.equal(files.files.get(`${ROOT}/.continuum-scripts/.gitignore`), '*\n');
        files.files.set(`${ROOT}/.continuum-scripts/.gitignore`, 'user edit\n');
        await store.open({ ...REQUEST, packageId: 'ctxtwo' });
        assert.equal(files.files.get(`${ROOT}/.continuum-scripts/.gitignore`), 'user edit\n');
    });

    it('opens nothing without a workspace folder', async () => {
        const { files, store } = setup(ROOT, false);
        assert.equal(await store.open(REQUEST), undefined);
        assert.equal(files.files.size, 0);
    });

    it('renews the lease while open and stops after dispose', async () => {
        const { files, timers, store } = setup();
        const opened = await store.open(REQUEST);
        timers.tick(LEASE_RENEW_MS);
        await Promise.resolve();
        assert.equal(files.files.get(`${ROOT}/.continuum-scripts/ctxone/.lease`), String(1000 + LEASE_RENEW_MS));
        await opened!.dispose();
        assert.equal(timers.callbacks.size, 0);
    });

    it('deletes the folder on dispose and leaves other editors alone', async () => {
        const { files, store } = setup();
        const first = await store.open(REQUEST);
        await store.open({ ...REQUEST, packageId: 'ctxtwo' });
        await first!.dispose();
        assert.equal(await files.exists(`${ROOT}/.continuum-scripts/ctxone`), false);
        assert.equal(await files.exists(`${ROOT}/.continuum-scripts/ctxtwo`), true);
    });

    it('does not throw from dispose after a failed write or a failed delete, and disposing twice is harmless', async () => {
        const failing = setup();
        failing.files.failWrites = true;
        await assert.rejects(() => failing.store.open(REQUEST), /disk full/);

        const stuck = setup();
        const opened = await stuck.store.open(REQUEST);
        stuck.files.failDeletes = true;
        await assert.doesNotReject(() => opened!.dispose());
        await assert.doesNotReject(() => opened!.dispose());
        assert.equal(stuck.warnings.length, 1);
    });

    it('cleans up a half-written folder when opening fails', async () => {
        const { files, store } = setup();
        const original = files.writeFile.bind(files);
        files.writeFile = async (path, text) => {
            if (path.endsWith('Script.kt')) {
                throw new Error('boom');
            }
            await original(path, text);
        };
        await assert.rejects(() => store.open(REQUEST), /boom/);
        assert.equal(await files.exists(`${ROOT}/.continuum-scripts/ctxone`), false);
    });

    it('writes the files again when another tab removed the folder while this editor was open', async () => {
        const { files, timers, store } = setup();
        await store.open(REQUEST);
        await files.deleteRecursive(`${ROOT}/.continuum-scripts/ctxone`);
        timers.tick(LEASE_RENEW_MS);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(files.files.get(`${ROOT}/.continuum-scripts/ctxone/Script.kt`), REQUEST.scriptText);
        assert.equal(files.files.get(`${ROOT}/.continuum-scripts/ctxone/.lease`), String(1000 + LEASE_RENEW_MS));
    });

    it('does not recreate a folder after the editor was closed', async () => {
        const { files, timers, store } = setup();
        const opened = await store.open(REQUEST);
        await opened?.dispose();
        timers.tick(LEASE_RENEW_MS);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(await files.exists(`${ROOT}/.continuum-scripts/ctxone`), false);
    });

    it('refuses to write through a hidden folder that is a symbolic link, and deletes nothing there', async () => {
        const { files, store } = setup();
        files.symlinks.add(`${ROOT}/.continuum-scripts`);
        await assert.rejects(store.open(REQUEST), /symbolic link/);
        assert.equal(files.files.size, 0);
    });

    it('writes no declarations file when there are no declarations', async () => {
        const { files, timers, store } = setup();
        await store.open({ packageId: 'ctxone', scriptText: 'x' });
        assert.deepEqual([...files.files.keys()].filter(path => path.endsWith('ScriptFlowVariables.kt')), []);
        await files.deleteRecursive(`${ROOT}/.continuum-scripts/ctxone`);
        timers.tick(LEASE_RENEW_MS);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(files.files.get(`${ROOT}/.continuum-scripts/ctxone/Script.kt`), 'x');
        assert.equal(files.files.has(`${ROOT}/.continuum-scripts/ctxone/ScriptFlowVariables.kt`), false);
    });
});
