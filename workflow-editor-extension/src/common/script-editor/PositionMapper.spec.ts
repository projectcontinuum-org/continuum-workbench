import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PositionMapper } from './PositionMapper';
import { LspDiagnostic, VirtualDocumentPlan } from './ScriptEditorTypes';

const headerPlan = (lineCount: number): VirtualDocumentPlan => ({
    hiddenBlocks: [{ beforeUserLine: 0, lines: Array.from({ length: lineCount }, (_, i) => `hidden ${i}`) }],
    trailingLines: ['hidden tail']
});

const diagnostic = (startLine: number, startCharacter: number, endLine: number, endCharacter: number): LspDiagnostic => ({
    range: { start: { line: startLine, character: startCharacter }, end: { line: endLine, character: endCharacter } },
    message: 'm'
});

test('a header of N lines shifts user lines by N and keeps the columns', () => {
    const mapper = new PositionMapper('alpha\nbeta', headerPlan(3));
    assert.equal(mapper.virtualText, 'hidden 0\nhidden 1\nhidden 2\nalpha\nbeta\nhidden tail');
    assert.deepEqual(mapper.toVirtualPosition({ line: 0, character: 4 }), { line: 3, character: 4 });
    assert.deepEqual(mapper.toVirtualPosition({ line: 1, character: 0 }), { line: 4, character: 0 });
    assert.deepEqual(mapper.toUserPosition({ line: 3, character: 4 }), { line: 0, character: 4 });
    assert.deepEqual(mapper.toUserPosition({ line: 4, character: 2 }), { line: 1, character: 2 });
});

test('first and last user line round-trip through the virtual text', () => {
    const userText = 'first\nmiddle\nlast';
    const mapper = new PositionMapper(userText, headerPlan(5));
    for (const line of [0, 1, 2]) {
        const virtual = mapper.toVirtualPosition({ line, character: 3 });
        assert.deepEqual(mapper.toUserPosition(virtual), { line, character: 3 });
    }
});

test('positions in hidden lines have no user position', () => {
    const mapper = new PositionMapper('x', headerPlan(2));
    assert.equal(mapper.toUserPosition({ line: 0, character: 1 }), undefined);
    assert.equal(mapper.toUserPosition({ line: 1, character: 0 }), undefined);
    assert.equal(mapper.toUserPosition({ line: 3, character: 0 }), undefined, 'trailing hidden line');
    assert.equal(mapper.toUserPosition({ line: 99, character: 0 }), undefined, 'past the end');
});

test('a plan without hidden text is the identity', () => {
    const mapper = new PositionMapper('a\nb', { hiddenBlocks: [], trailingLines: [] });
    assert.equal(mapper.virtualText, 'a\nb');
    assert.deepEqual(mapper.toVirtualPosition({ line: 1, character: 1 }), { line: 1, character: 1 });
    assert.deepEqual(mapper.toUserPosition({ line: 1, character: 1 }), { line: 1, character: 1 });
});

test('CRLF and lone CR line breaks count as one line break each and become LF in the virtual text', () => {
    const mapper = new PositionMapper('a\r\nb\rc', headerPlan(1));
    assert.equal(mapper.userLineCount, 3);
    assert.equal(mapper.virtualText, 'hidden 0\na\nb\nc\nhidden tail');
    assert.deepEqual(mapper.toVirtualPosition({ line: 2, character: 1 }), { line: 3, character: 1 });
});

test('an empty text has one empty line and still maps', () => {
    const mapper = new PositionMapper('', headerPlan(2));
    assert.equal(mapper.userLineCount, 1);
    assert.equal(mapper.virtualText, 'hidden 0\nhidden 1\n\nhidden tail');
    assert.deepEqual(mapper.toVirtualPosition({ line: 0, character: 0 }), { line: 2, character: 0 });
});

test('a block in the middle shifts only the lines after it', () => {
    const plan: VirtualDocumentPlan = {
        hiddenBlocks: [{ beforeUserLine: 1, lines: ['h1', 'h2'] }],
        trailingLines: []
    };
    const mapper = new PositionMapper('import a\nbody 1\nbody 2', plan);
    assert.equal(mapper.virtualText, 'import a\nh1\nh2\nbody 1\nbody 2');
    assert.deepEqual(mapper.toVirtualPosition({ line: 0, character: 3 }), { line: 0, character: 3 });
    assert.deepEqual(mapper.toVirtualPosition({ line: 1, character: 3 }), { line: 3, character: 3 });
    assert.deepEqual(mapper.toUserPosition({ line: 4, character: 1 }), { line: 2, character: 1 });
    assert.equal(mapper.toUserPosition({ line: 1, character: 0 }), undefined);
});

test('several blocks at the same line are concatenated in order; a block after the last line is allowed', () => {
    const plan: VirtualDocumentPlan = {
        hiddenBlocks: [
            { beforeUserLine: 0, lines: ['a'] },
            { beforeUserLine: 0, lines: ['b'] },
            { beforeUserLine: 2, lines: ['end'] }
        ],
        trailingLines: ['tail']
    };
    const mapper = new PositionMapper('x\ny', plan);
    assert.equal(mapper.virtualText, 'a\nb\nx\ny\nend\ntail');
});

test('a block placed outside the text or holding a line break is rejected', () => {
    assert.throws(() => new PositionMapper('x', { hiddenBlocks: [{ beforeUserLine: 2, lines: ['h'] }], trailingLines: [] }), RangeError);
    assert.throws(() => new PositionMapper('x', { hiddenBlocks: [{ beforeUserLine: -1, lines: ['h'] }], trailingLines: [] }), RangeError);
    assert.throws(() => new PositionMapper('x', { hiddenBlocks: [{ beforeUserLine: 0, lines: ['h\ni'] }], trailingLines: [] }), RangeError);
});

test('user positions past the end are clamped to the nearest line', () => {
    const mapper = new PositionMapper('a\nb', headerPlan(1));
    assert.deepEqual(mapper.toVirtualPosition({ line: 7, character: 0 }), { line: 2, character: 0 });
    assert.deepEqual(mapper.toVirtualPosition({ line: -3, character: 0 }), { line: 1, character: 0 });
});

test('a diagnostic wholly inside the hidden header or trailer is dropped', () => {
    const mapper = new PositionMapper('abc', headerPlan(3));
    const mapped = mapper.toUserDiagnostics([diagnostic(0, 0, 0, 5), diagnostic(1, 2, 2, 4), diagnostic(4, 0, 4, 5)]);
    assert.deepEqual(mapped, []);
});

test('a diagnostic in the user text is shifted back to the text the user sees', () => {
    const mapper = new PositionMapper('// a\n// b\nval x: Int = "a"', headerPlan(4));
    const mapped = mapper.toUserDiagnostics([diagnostic(6, 13, 6, 16)]);
    assert.deepEqual(mapped.map(d => d.range), [{ start: { line: 2, character: 13 }, end: { line: 2, character: 16 } }]);
});

test('a diagnostic that starts in the header is clamped to the start of the user text', () => {
    const mapper = new PositionMapper('abc\ndef', headerPlan(2));
    const [mapped] = mapper.toUserDiagnostics([diagnostic(1, 3, 3, 2)]);
    assert.deepEqual(mapped.range, { start: { line: 0, character: 0 }, end: { line: 1, character: 2 } });
});

test('a diagnostic that ends in the trailer is clamped to the end of the last user line', () => {
    const mapper = new PositionMapper('abc\ndef', headerPlan(2));
    const [mapped] = mapper.toUserDiagnostics([diagnostic(3, 1, 5, 4)]);
    assert.deepEqual(mapped.range, { start: { line: 1, character: 1 }, end: { line: 1, character: 3 } });
});

test('a diagnostic that only touches the user text at a boundary is dropped, not turned into an empty range', () => {
    const mapper = new PositionMapper('abc', headerPlan(2));
    assert.deepEqual(mapper.toUserDiagnostics([diagnostic(1, 0, 2, 0)]), [], 'ends at column 0 of the first user line');
    assert.deepEqual(mapper.toUserDiagnostics([diagnostic(2, 3, 4, 0)]), [], 'starts at the end of the last user line');
});

test('an empty range inside the user text is kept', () => {
    const mapper = new PositionMapper('abc', headerPlan(1));
    const mapped = mapper.toUserDiagnostics([diagnostic(1, 2, 1, 2)]);
    assert.equal(mapped.length, 1);
});

test('a range spanning hidden text between two user lines is kept and mapped line by line', () => {
    const plan: VirtualDocumentPlan = { hiddenBlocks: [{ beforeUserLine: 1, lines: ['h1', 'h2'] }], trailingLines: [] };
    const mapper = new PositionMapper('abc\ndef', plan);
    const range = mapper.toUserRange({ start: { line: 0, character: 1 }, end: { line: 3, character: 2 } });
    assert.deepEqual(range, { start: { line: 0, character: 1 }, end: { line: 1, character: 2 } });
});

test('diagnostic fields other than the range survive mapping', () => {
    const mapper = new PositionMapper('abc', headerPlan(1));
    const input = { ...diagnostic(1, 0, 1, 2), severity: 1 as const, code: 'X', source: 's', message: 'boom' };
    const [mapped] = mapper.toUserDiagnostics([input]);
    assert.equal(mapped.message, 'boom');
    assert.equal(mapped.severity, 1);
    assert.equal(mapped.code, 'X');
    assert.equal(mapped.source, 's');
});

test('toVirtualRange maps both ends', () => {
    const mapper = new PositionMapper('ab\ncd', headerPlan(2));
    assert.deepEqual(mapper.toVirtualRange({ start: { line: 0, character: 1 }, end: { line: 1, character: 2 } }), {
        start: { line: 2, character: 1 },
        end: { line: 3, character: 2 }
    });
});

test('errors in the trailing hidden lines are shown on the last user line only when the plan asks for it', () => {
    const plan = (show: boolean) => ({ hiddenBlocks: [], trailingLines: ['}'], showTrailingErrorsOnLastUserLine: show });
    const diagnostic = { range: { start: { line: 1, character: 0 }, end: { line: 1, character: 1 } }, message: 'unclosed', severity: 1 as const };
    assert.deepEqual(new PositionMapper('open {', plan(false)).toUserDiagnostics([diagnostic]), []);
    const [shown] = new PositionMapper('open {', plan(true)).toUserDiagnostics([diagnostic]);
    assert.deepEqual(shown.range, { start: { line: 0, character: 5 }, end: { line: 0, character: 6 } });
});

test('with the flag on, only errors on the plan trailing lines move to the last user line', () => {
    const plan = { hiddenBlocks: [{ beforeUserLine: 0, lines: ['header'] }], trailingLines: ['tail'], showTrailingErrorsOnLastUserLine: true };
    const mapper = new PositionMapper('abc', plan);
    const error = (line: number) => ({ range: { start: { line, character: 0 }, end: { line, character: 3 } }, message: 'e', severity: 1 as const });
    assert.deepEqual(mapper.toUserDiagnostics([error(0)]), [], 'header line');
    assert.equal(mapper.toUserDiagnostics([error(2)]).length, 1, 'tail line');
});
