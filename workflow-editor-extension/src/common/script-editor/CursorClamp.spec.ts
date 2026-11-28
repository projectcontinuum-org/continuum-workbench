import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clampToVisible } from './CursorClamp';

// package(0), header(1), user lines (2, 3), closing(4)
const LINES = ['package ctx', 'fun script(): Any? = run {', 'val a = 1', 'a', '}'];
const LOCATION = { packageIndex: 0, headerIndex: 1, closingIndex: 4 };

describe('clamping a cursor out of the hidden wrapper', () => {
    it('leaves a position on a visible line alone', () => {
        assert.deepEqual(clampToVisible({ line: 3, column: 4 }, LINES, LOCATION), { line: 3, column: 4 });
    });

    it('moves a position on the closing line to the end of the last user line', () => {
        assert.deepEqual(clampToVisible({ line: 5, column: 2 }, LINES, LOCATION), { line: 4, column: 2 });
    });

    it('moves a position on the first hidden lines to the start of the first user line', () => {
        assert.deepEqual(clampToVisible({ line: 1, column: 1 }, LINES, LOCATION), { line: 3, column: 1 });
        assert.deepEqual(clampToVisible({ line: 2, column: 5 }, LINES, LOCATION), { line: 3, column: 1 });
    });

    it('moves a header between the imports and the body to the end of the import line above', () => {
        const lines = ['package ctx', 'import a.B', 'fun script(): Any? = run {', 'val a = 1', '}'];
        assert.deepEqual(clampToVisible({ line: 3, column: 1 }, lines, { packageIndex: 0, headerIndex: 2, closingIndex: 4 }), { line: 2, column: 11 });
    });
});
