import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createPackageId, isPackageId } from './ScriptFileNaming';

describe('script package ids', () => {
    it('are shaped like a Kotlin package name and recognised as ours', () => {
        const id = createPackageId();
        assert.match(id, /^ctx[a-z0-9]{16}$/);
        assert.equal(isPackageId(id), true);
        assert.equal(isPackageId('.gitignore'), false);
        assert.equal(isPackageId('ctx'), false);
        assert.equal(isPackageId('Script.kt'), false);
    });

    it('are never shared by two editors, even when the source of randomness repeats itself', () => {
        let calls = 0;
        const repeating = (length: number): Uint8Array => {
            calls += 1;
            return new Uint8Array(length).fill(calls <= 2 ? 7 : calls);
        };
        const first = createPackageId(repeating);
        const second = createPackageId(repeating);
        assert.notEqual(first, second);
    });

    it('are not reused after a session has issued many', () => {
        const ids = new Set(Array.from({ length: 500 }, () => createPackageId()));
        assert.equal(ids.size, 500);
    });
});
