import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    MAX_START_ERROR_LENGTH,
    messageFromBody,
    readStartedWorkflowId,
    startFailureMessage,
    startNetworkFailure,
    StartResponseLike,
    StartWorkflowError,
} from './StartWorkflowResult';

function response(status: number, body: string, statusText = ''): StartResponseLike & { reads: number } {
    const r = {
        status,
        ok: status >= 200 && status < 300,
        statusText,
        reads: 0,
        async text() {
            r.reads += 1;
            return body;
        },
    };
    return r;
}

async function failure(r: StartResponseLike): Promise<StartWorkflowError> {
    try {
        await readStartedWorkflowId(r);
    } catch (e) {
        assert.ok(e instanceof StartWorkflowError, `expected a StartWorkflowError, got ${String(e)}`);
        return e;
    }
    assert.fail('expected the start to be rejected, but it was reported as started');
}

test('200 with a workflow id returns the id', async () => {
    assert.equal(await readStartedWorkflowId(response(200, '{"workflowId":"7cac18ee-f2d3"}')), '7cac18ee-f2d3');
});

test('200 with no workflow id is a failure, NOT a started workflow', async () => {
    // The original bug: the body was read as a start response whatever the content, and undefined was passed on.
    for (const body of ['{}', '{"workflowId":""}', '{"workflowId":42}', '{"workflowId":null}', '[]', 'null', '', 'not json']) {
        const e = await failure(response(200, body));
        assert.equal(e.status, 200, body);
        assert.match(e.message, /did not return a workflow id/, body);
    }
});

test('400 from Spring (no detail) says the workflow was rejected and what to check', async () => {
    const body = '{"timestamp":"2026-11-14T00:00:00Z","status":400,"error":"Bad Request","path":"/api/v1/workflow"}';
    const e = await failure(response(400, body, 'Bad Request'));
    assert.equal(e.status, 400);
    assert.match(e.message, /rejected this workflow as invalid.*node settings and connections/);
});

test('400 with problem-detail uses the server\'s own explanation', async () => {
    const body = '{"type":"about:blank","title":"Bad Request","status":400,"detail":"Invalid node: ConditionalSplitter threshold must be a number"}';
    const e = await failure(response(400, body, 'Bad Request'));
    assert.equal(e.message, 'Invalid node: ConditionalSplitter threshold must be a number');
});

test('403 and 401 say the user is not allowed', async () => {
    assert.match((await failure(response(403, '', 'Forbidden'))).message, /not allowed to run workflows/);
    assert.match((await failure(response(401, '', 'Unauthorized'))).message, /not allowed to run workflows/);
});

test('500 says the server failed, and keeps a useful server message', async () => {
    assert.equal((await failure(response(500, '{"status":500,"error":"Internal Server Error"}', 'Internal Server Error'))).message,
        'The server failed to start the workflow (500)');
    assert.equal((await failure(response(503, '{"detail":"Temporal is unavailable"}', 'Service Unavailable'))).message,
        'The server failed to start the workflow: Temporal is unavailable');
});

test('an HTML error page (proxy, gateway) never reaches the user', async () => {
    const e = await failure(response(502, '<html><body><h1>502 Bad Gateway</h1></body></html>', 'Bad Gateway'));
    assert.equal(e.message, 'The server failed to start the workflow (502)');
    assert.doesNotMatch(e.message, /</);
});

test('a plain-text error body from a gateway is used as it is', async () => {
    assert.equal((await failure(response(504, 'upstream timed out', 'Gateway Timeout'))).message,
        'The server failed to start the workflow: upstream timed out');
});

test('a very long server message is cut to fit a notification', async () => {
    const e = await failure(response(500, JSON.stringify({ detail: 'x'.repeat(2000) })));
    assert.ok(e.message.endsWith('…'));
    assert.ok(e.message.length <= MAX_START_ERROR_LENGTH + 'The server failed to start the workflow: '.length + 1);
});

test('other statuses name the status', async () => {
    assert.equal((await failure(response(404, '', 'Not Found'))).message, 'The server answered 404 Not Found');
    assert.equal((await failure(response(418, '', ''))).message, 'The server answered 418');
});

test('the status decides before the body: a 4xx/5xx body that looks like a start response is still a failure', async () => {
    const e = await failure(response(500, '{"workflowId":"looks-fine"}', 'Internal Server Error'));
    assert.equal(e.status, 500);
});

test('an unreadable body does not hide the status', async () => {
    const broken: StartResponseLike = { status: 500, ok: false, statusText: 'Internal Server Error', text: async () => { throw new Error('stream closed'); } };
    assert.equal((await failure(broken)).message, 'The server failed to start the workflow (500)');
});

test('messageFromBody prefers detail, then message, then error, and ignores blanks', () => {
    assert.equal(messageFromBody('{"detail":"a","message":"b","error":"c"}'), 'a');
    assert.equal(messageFromBody('{"detail":"  ","message":"b","error":"c"}'), 'b');
    assert.equal(messageFromBody('{"error":"c"}'), 'c');
    assert.equal(messageFromBody('{"status":400}'), undefined);
    assert.equal(messageFromBody(''), undefined);
    assert.equal(messageFromBody('  '), undefined);
    assert.equal(messageFromBody('<!doctype html>'), undefined);
    assert.equal(messageFromBody('[1,2]'), undefined);
});

test('a server message that only repeats the status phrase adds nothing', () => {
    assert.match(startFailureMessage(400, 'Bad Request', 'Bad Request'), /rejected this workflow as invalid/);
    assert.equal(startFailureMessage(400, 'Bad Request', 'Threshold missing'), 'Threshold missing');
});

test('status 0 is "could not be reached"', () => {
    assert.equal(startFailureMessage(0, ''), 'The workflow server could not be reached');
});

test('startNetworkFailure names the cause and has status 0', () => {
    const e = startNetworkFailure(new TypeError('Failed to fetch'));
    assert.equal(e.status, 0);
    assert.equal(e.message, 'The workflow server could not be reached (Failed to fetch)');
    assert.equal(startNetworkFailure('boom').message, 'The workflow server could not be reached (boom)');
});
