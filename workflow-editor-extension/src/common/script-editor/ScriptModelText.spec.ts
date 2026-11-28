import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { KotlinScriptContext } from './KotlinScriptContext';
import { scriptWrapper } from './KotlinScriptPrelude';
import { hiddenRangesOf, locateWrapper, modelTextOf, relayoutEdits, TextEdit, userTextOf } from './ScriptModelText';

const CONTEXT: KotlinScriptContext = { bindings: [{ name: 'a', type: 'Int' }], declarations: 'interface Thing\n' };
const WRAPPER = scriptWrapper('ctxabc', CONTEXT);

const model = (userText: string) => modelTextOf(userText, WRAPPER).text;

/** Applies edits the way the editor does: all against the original lines, from the bottom up. */
function apply(lines: readonly string[], edits: readonly TextEdit[]): string[] {
    const text = lines.join('\n');
    const offsetOf = (line: number, column: number): number =>
        lines.slice(0, line - 1).reduce((sum, current) => sum + current.length + 1, 0) + column - 1;
    return [...edits]
        .sort((first, second) => offsetOf(second.startLine, second.startColumn) - offsetOf(first.startLine, first.startColumn))
        .reduce((result, edit) => {
            const from = offsetOf(edit.startLine, edit.startColumn);
            const to = offsetOf(edit.endLine, edit.endColumn);
            return result.slice(0, from) + edit.text + result.slice(to);
        }, text)
        .split('\n');
}

describe('text taken from the model', () => {
    for (const text of ['', 'a', 'a.toString()', 'if (a > 0) {\n  1\n}\n}', 'import x.Y\n\n}', '@file:Suppress("x")\nimport x.Y\nval q = "é✓"\n']) {
        it(`returns exactly what was typed: ${JSON.stringify(text)}`, () => {
            assert.equal(userTextOf(model(text), WRAPPER), text);
        });
    }

    it('turns CRLF line breaks of the typed text into line feeds', () => {
        assert.equal(userTextOf(model('a\r\nb'), WRAPPER), 'a\nb');
    });

    it('puts the user text back between the same wrapper after a programmatic replace', () => {
        const after = model('two\nthree');
        assert.equal(userTextOf(after, WRAPPER), 'two\nthree');
        assert.deepEqual(locateWrapper(after.split('\n'), WRAPPER), { packageIndex: 0, headerIndex: 1, closingIndex: 4 });
    });

    it('recovers the user text when the wrapper was destroyed by a select-all replace', () => {
        assert.equal(userTextOf('plain text only', WRAPPER), 'plain text only');
        assert.equal(userTextOf(`${WRAPPER.packageLine}\nmine`, WRAPPER), 'mine');
    });

    it('keeps a closing brace that may be the user own when the header is gone', () => {
        assert.equal(userTextOf('if (x) {\n}', WRAPPER), 'if (x) {\n}');
    });
});

describe('locating the wrapper', () => {
    it('finds the three lines and reports them as hidden ranges', () => {
        const lines = model('import a.B\nval x = 1').split('\n');
        const location = locateWrapper(lines, WRAPPER);
        assert.deepEqual(location, { packageIndex: 0, headerIndex: 2, closingIndex: 4 });
        assert.deepEqual(hiddenRangesOf(location!), [{ startLine: 1, endLine: 1 }, { startLine: 3, endLine: 3 }, { startLine: 5, endLine: 5 }]);
    });

    it('merges adjacent wrapper lines into one range', () => {
        const location = locateWrapper(model('x').split('\n'), WRAPPER)!;
        assert.deepEqual(hiddenRangesOf(location), [{ startLine: 1, endLine: 2 }, { startLine: 4, endLine: 4 }]);
    });

    it('reports no location when a wrapper line is missing', () => {
        assert.equal(locateWrapper(['a', 'b'], WRAPPER), undefined);
        assert.equal(locateWrapper([WRAPPER.packageLine, 'x', '}'], WRAPPER), undefined);
        assert.equal(locateWrapper([WRAPPER.packageLine, WRAPPER.headerLine, 'x'], WRAPPER), undefined);
    });
});

describe('moving the wrapper lines when the leading imports change', () => {
    const relayout = (lines: string[]): string[] => apply(lines, relayoutEdits(lines, locateWrapper(lines, WRAPPER)!, WRAPPER));

    it('has nothing to do when the layout is already right', () => {
        const lines = model('import a.B\nval x = 1').split('\n');
        assert.deepEqual(relayoutEdits(lines, locateWrapper(lines, WRAPPER)!, WRAPPER), []);
    });

    it('moves the header below an import typed at the top of the script', () => {
        assert.deepEqual(relayout([WRAPPER.packageLine, WRAPPER.headerLine, 'import a.B', 'val x = 1', '}']), [
            WRAPPER.packageLine, 'import a.B', WRAPPER.headerLine, 'val x = 1', '}'
        ]);
    });

    it('moves the header back up when the last import is removed', () => {
        assert.deepEqual(relayout([WRAPPER.packageLine, '', WRAPPER.headerLine, 'val x = 1', '}']), [
            WRAPPER.packageLine, WRAPPER.headerLine, '', 'val x = 1', '}'
        ]);
    });

    it('moves the package line below a file annotation typed at the top', () => {
        assert.deepEqual(relayout([WRAPPER.packageLine, WRAPPER.headerLine, '@file:Suppress("x")', 'val x = 1', '}']), [
            '@file:Suppress("x")', WRAPPER.packageLine, WRAPPER.headerLine, 'val x = 1', '}'
        ]);
    });

    it('never changes the user text', () => {
        const lines = [WRAPPER.packageLine, WRAPPER.headerLine, 'import a.B', 'import c.D', 'val x = 1', '}'];
        assert.equal(userTextOf(relayout(lines).join('\n'), WRAPPER), userTextOf(lines.join('\n'), WRAPPER));
    });
});
