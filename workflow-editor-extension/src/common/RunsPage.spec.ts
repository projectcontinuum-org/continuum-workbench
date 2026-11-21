import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasMorePages, readRunsPage } from './RunsPage';

// The shape the api-server sends for GET /api/v1/workflow-runs (Spring Data PagedModel, VIA_DTO).
const pagedModel = {
    content: [{ workflowId: 'a' }, { workflowId: 'b' }],
    page: { size: 2, number: 0, totalElements: 5, totalPages: 3 },
};

test('reads the paging numbers from the nested page object', () => {
    const page = readRunsPage(pagedModel);
    assert.equal(page.totalPages, 3);
    assert.equal(page.totalElements, 5);
    assert.equal(page.number, 0);
    assert.equal(page.size, 2);
    assert.deepEqual(page.content.map(run => run.workflowId), ['a', 'b']);
});

test('a later page exists until the last one', () => {
    const page = readRunsPage(pagedModel);
    assert.equal(hasMorePages(page, 0), true);
    assert.equal(hasMorePages(page, 1), true);
    assert.equal(hasMorePages(page, 2), false);
});

test('a top-level totalPages (the old, wrong assumption) is not what decides', () => {
    const page = readRunsPage({ content: [], totalPages: 9, page: { totalPages: 1 } } as never);
    assert.equal(page.totalPages, 1);
});

test('a page without metadata is the only page', () => {
    const page = readRunsPage({ content: [{ workflowId: 'a' }] });
    assert.equal(page.totalPages, 1);
    assert.equal(page.totalElements, 1);
    assert.equal(hasMorePages(page, 0), false);
});

test('an empty or missing body is an empty page, never NaN', () => {
    for (const body of [undefined, null, {} as never, { content: [] }]) {
        const page = readRunsPage(body);
        assert.deepEqual(page.content, []);
        assert.equal(page.totalPages, 0);
        assert.equal(hasMorePages(page, 0), false);
    }
});
