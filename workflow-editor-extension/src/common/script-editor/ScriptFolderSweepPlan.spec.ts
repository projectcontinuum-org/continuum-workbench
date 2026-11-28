import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { foldersToSweep } from './ScriptFolderSweepPlan';
import { LEASE_EXPIRY_MS } from './ScriptFolderLayout';

const NOW = 1_000_000;
const ID = (suffix: string): string => `ctx${suffix.padEnd(16, '0')}`;

describe('the sweep plan', () => {
    it('removes folders whose lease is missing or older than the expiry', () => {
        const entries = [
            { name: ID('missing'), leasedAt: undefined },
            { name: ID('stale'), leasedAt: NOW - LEASE_EXPIRY_MS - 1 },
            { name: ID('garbled'), leasedAt: Number.NaN }
        ];
        assert.deepEqual(foldersToSweep(entries, NOW), [ID('missing'), ID('stale'), ID('garbled')]);
    });

    it('keeps folders with a fresh lease, including one exactly at the limit', () => {
        const entries = [
            { name: ID('fresh'), leasedAt: NOW - 1000 },
            { name: ID('edge'), leasedAt: NOW - LEASE_EXPIRY_MS }
        ];
        assert.deepEqual(foldersToSweep(entries, NOW), []);
    });

    it('ignores entries that are not shaped like an editor folder', () => {
        const entries = [
            { name: '.gitignore', leasedAt: undefined },
            { name: 'notes', leasedAt: undefined },
            { name: 'ctx', leasedAt: undefined }
        ];
        assert.deepEqual(foldersToSweep(entries, NOW), []);
    });
});
