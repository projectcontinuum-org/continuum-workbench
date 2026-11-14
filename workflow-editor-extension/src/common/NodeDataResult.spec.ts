import { test } from 'node:test';
import assert from 'node:assert/strict';
import { networkFailure, ResponseLike, toNodeDataResult } from './NodeDataResult';

const PAGE = { data: [[{ name: 'id', value: 'MQ==', contentType: 'application/vnd.continuum.x-int' }]], totalElements: 1 };

/** A fake Response. `body` is what json() resolves to; INVALID makes json() throw like a non-JSON body does. */
const INVALID = Symbol('invalid json');
function response(status: number, body: unknown = PAGE, statusText = ''): ResponseLike & { jsonCalls: number } {
    const r = {
        status,
        ok: status >= 200 && status < 300,
        statusText,
        jsonCalls: 0,
        async json() {
            r.jsonCalls += 1;
            if (body === INVALID) {
                throw new SyntaxError('Unexpected token < in JSON');
            }
            return body;
        },
    };
    return r;
}

test('200 returns the page the server sent', async () => {
    const result = await toNodeDataResult<typeof PAGE>(response(200));
    assert.deepEqual(result, { kind: 'page', page: PAGE });
});

test('404 is "not found" and the body is never read (it is a problem-detail object, not a page)', async () => {
    // The api-server's 404 body: {"detail":"Workflow run not found","status":404,...}. Reading it as a page is the crash.
    const r = response(404, { detail: 'Workflow run not found', status: 404, title: 'Not Found' });
    assert.deepEqual(await toNodeDataResult(r), { kind: 'not-found' });
    assert.equal(r.jsonCalls, 0);
});

test('404 is "not found" even when the body is not JSON at all', async () => {
    assert.deepEqual(await toNodeDataResult(response(404, INVALID)), { kind: 'not-found' });
});

test('other client and server errors are errors that name the status, not "not found"', async () => {
    for (const [status, text] of [[400, 'Bad Request'], [401, 'Unauthorized'], [403, 'Forbidden'], [500, 'Internal Server Error'], [502, 'Bad Gateway']] as const) {
        const result = await toNodeDataResult(response(status, PAGE, text));
        assert.deepEqual(result, { kind: 'error', message: `The server answered ${status} ${text}` }, String(status));
    }
});

test('an error status with no status text has no trailing space in its message', async () => {
    assert.deepEqual(await toNodeDataResult(response(503)), { kind: 'error', message: 'The server answered 503' });
});

test('a 200 whose body is not JSON is an error, not an exception', async () => {
    assert.deepEqual(await toNodeDataResult(response(200, INVALID)), {
        kind: 'error',
        message: 'The server sent a response that is not valid JSON',
    });
});

test('an error response does not read the body either', async () => {
    const r = response(500);
    await toNodeDataResult(r);
    assert.equal(r.jsonCalls, 0);
});

test('networkFailure reports the message of an Error and the text of anything else', () => {
    assert.deepEqual(networkFailure(new TypeError('Failed to fetch')), { kind: 'error', message: 'Failed to fetch' });
    assert.deepEqual(networkFailure('boom'), { kind: 'error', message: 'boom' });
    assert.deepEqual(networkFailure(undefined), { kind: 'error', message: 'undefined' });
});
