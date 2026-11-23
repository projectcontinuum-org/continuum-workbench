import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toHttpReply } from './HttpReply';
import { readStartedWorkflowId } from './StartWorkflowResult';
import { toNodeDataResult } from './NodeDataResult';

test('ok is true for 2xx only', () => {
    for (const [status, ok] of [[199, false], [200, true], [204, true], [299, true], [300, false], [404, false], [500, false]] as const) {
        assert.equal(toHttpReply({ status, statusText: '', data: null }).ok, ok, String(status));
    }
});

test('text() returns a string body as it is and serializes a parsed body', async () => {
    assert.equal(await toHttpReply({ status: 502, statusText: '', data: '<html>502</html>' }).text(), '<html>502</html>');
    assert.equal(await toHttpReply({ status: 400, statusText: '', data: { detail: 'bad' } }).text(), '{"detail":"bad"}');
    assert.equal(await toHttpReply({ status: 204, statusText: '', data: undefined }).text(), '');
    assert.equal(await toHttpReply({ status: 204, statusText: '', data: null }).text(), '');
});

test('text() does not throw for a body that cannot be serialized', async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    assert.equal(await toHttpReply({ status: 500, statusText: '', data: circular }).text(), '');
});

test('json() returns a parsed body, parses a string body and rejects a string that is not JSON', async () => {
    assert.deepEqual(await toHttpReply({ status: 200, statusText: '', data: { a: 1 } }).json(), { a: 1 });
    assert.deepEqual(await toHttpReply({ status: 200, statusText: '', data: '{"a":1}' }).json(), { a: 1 });
    await assert.rejects(toHttpReply({ status: 200, statusText: '', data: '<html>' }).json(), SyntaxError);
});

test('a reply feeds the start helper: an axios-parsed body still yields the workflow id, a failure still throws', async () => {
    assert.equal(await readStartedWorkflowId(toHttpReply({ status: 200, statusText: 'OK', data: { workflowId: 'abc' } })), 'abc');
    await assert.rejects(
        readStartedWorkflowId(toHttpReply({ status: 400, statusText: 'Bad Request', data: { detail: 'Invalid node: x' } })),
        /Invalid node: x/,
    );
});

test('a reply feeds the node-data helper: 404 is not-found and its body is not read as a page', async () => {
    assert.deepEqual(
        await toNodeDataResult(toHttpReply({ status: 404, statusText: 'Not Found', data: { detail: 'Workflow run not found' } })),
        { kind: 'not-found' },
    );
    assert.deepEqual(
        await toNodeDataResult(toHttpReply({ status: 200, statusText: 'OK', data: { data: [], totalElements: 0 } })),
        { kind: 'page', page: { data: [], totalElements: 0 } },
    );
});
