import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatActiveFile, MAX_CONTEXT_CHARS, NO_ACTIVE_FILE, summarizeWorkflow } from './ActiveFileContext';

const cwf = JSON.stringify({
    id: 'abc', name: 'Render', active: false,
    nodes: [
        { id: 't', type: 'BaseNode', position: { x: 0, y: 0 }, data: { id: 'x.Create', nodeModel: 'x.Create', icon: '<svg/>', propertiesSchema: { big: true }, properties: { rows: '[]' } } },
        { id: 'r', type: 'BaseNode', position: { x: 330, y: 0 }, data: { id: 'x.Svg', nodeModel: 'x.Svg', properties: { width: 400 } } }
    ],
    edges: [{ id: 'e', type: 'BaseEdge', source: 't', sourceHandle: 'data', target: 'r', targetHandle: 'input' }]
});

test('no open file gives a fixed message', () => {
    assert.equal(formatActiveFile(undefined), NO_ACTIVE_FILE);
});

test('a .cwf file is shown as a compact spec without icons or schemas', () => {
    const text = formatActiveFile({ path: 'ws/render.cwf', content: cwf });
    assert.match(text, /File: ws\/render\.cwf/);
    assert.match(text, /Continuum workflow/);
    assert.match(text, /"nodeId": "x\.Svg"/);
    assert.match(text, /"fromPort": "data"/);
    assert.doesNotMatch(text, /svg\/>|propertiesSchema|position/);
});

test('summarizeWorkflow maps nodes and edges to the spec format', () => {
    assert.deepEqual(summarizeWorkflow(cwf), {
        name: 'Render',
        nodes: [{ key: 't', nodeId: 'x.Create', properties: { rows: '[]' } }, { key: 'r', nodeId: 'x.Svg', properties: { width: 400 } }],
        edges: [{ from: 't', fromPort: 'data', to: 'r', toPort: 'input' }]
    });
    assert.equal(summarizeWorkflow('not json'), undefined);
    assert.equal(summarizeWorkflow('{"a":1}'), undefined);
});

test('a broken .cwf falls back to the raw content', () => {
    const text = formatActiveFile({ path: 'ws/broken.cwf', content: '{oops' });
    assert.match(text, /Content:\n```\n\{oops\n```/);
});

test('selected text is shown before the content', () => {
    const text = formatActiveFile({ path: 'ws/mols.csv', content: 'name,smiles\naspirin,CC(=O)O', selectedText: 'aspirin,CC(=O)O' });
    assert.ok(text.indexOf('Selected text') < text.indexOf('Content'));
    assert.match(text, /Selected text:\n```\naspirin,CC\(=O\)O\n```/);
});

test('long content is truncated and says so', () => {
    const content = 'x'.repeat(MAX_CONTEXT_CHARS + 10);
    const text = formatActiveFile({ path: 'ws/big.txt', content });
    assert.match(text, new RegExp(`first ${MAX_CONTEXT_CHARS} of ${MAX_CONTEXT_CHARS + 10} characters`));
    assert.ok(!text.includes('x'.repeat(MAX_CONTEXT_CHARS + 1)));
});

test('the fence is longer than any backtick run in the content', () => {
    const text = formatActiveFile({ path: 'ws/README.md', content: 'a\n```js\ncode\n```\n' });
    assert.match(text, /Content:\n````\n/);
    assert.ok(text.endsWith('\n````'));
});

test('a read error is reported with the path', () => {
    assert.equal(formatActiveFile({ path: 'ws/x.bin', error: 'too big' }), 'File: ws/x.bin\n\nThe content could not be read: too big');
});
