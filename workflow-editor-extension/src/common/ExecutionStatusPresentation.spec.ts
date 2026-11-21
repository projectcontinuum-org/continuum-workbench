import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    EDGE_STATUS_PRESENTATION,
    edgeStatusPresentation,
    NODE_STATUS_PRESENTATION,
    nodeStatusClass,
    nodeStatusPresentation,
} from './ExecutionStatusPresentation';

test('every node status reported by the workflow has a label, colour and description', () => {
    const statuses = Object.keys(NODE_STATUS_PRESENTATION);
    assert.deepEqual(statuses.sort(), [
        'ACTIVE', 'BUSY', 'CANCELLED', 'CONFIGURED', 'FAILED', 'POST_PROCESSING', 'PRE_PROCESSING', 'SCHEDULED',
        'SKIPPED', 'SUCCESS', 'WARNING',
    ]);
    for (const status of statuses) {
        const presentation = nodeStatusPresentation(status);
        assert.ok(presentation.label, status);
        assert.ok(presentation.color, status);
        assert.ok(presentation.description, status);
    }
});

test('a scheduled node shows a badge, not a progress indicator, until its activity reports BUSY', () => {
    assert.equal(nodeStatusPresentation('SCHEDULED').working, false);
    assert.equal(nodeStatusPresentation('SCHEDULED').badge, 'scheduled');
    assert.equal(nodeStatusPresentation('BUSY').working, true);
    assert.equal(nodeStatusPresentation('BUSY').badge, undefined);
});

test('pre- and post-processing use the underscore values the backend sends', () => {
    assert.equal(nodeStatusPresentation('PRE_PROCESSING').working, true);
    assert.equal(nodeStatusPresentation('POST_PROCESSING').working, true);
    assert.equal(nodeStatusPresentation('PRE-PROCESSING').working, false);
});

test('skipped and cancelled nodes are shown as not run', () => {
    assert.equal(nodeStatusPresentation('SKIPPED').badge, 'skipped');
    assert.equal(nodeStatusPresentation('SKIPPED').color, 'text.disabled');
    assert.equal(nodeStatusPresentation('CANCELLED').badge, 'cancelled');
});

test('an unknown node status is shown as-is without a badge', () => {
    assert.deepEqual(nodeStatusPresentation('PAUSED'), {
        label: 'PAUSED', color: 'text.secondary', description: 'PAUSED', working: false,
    });
});

test('the node status class is derived from the status', () => {
    assert.equal(nodeStatusClass('SKIPPED'), 'node-status--skipped');
    assert.equal(nodeStatusClass('PRE_PROCESSING'), 'node-status--pre_processing');
    assert.equal(nodeStatusClass(undefined), undefined);
});

test('a broken edge gets the broken-wire mark and a delivered edge does not', () => {
    assert.deepEqual(Object.keys(EDGE_STATUS_PRESENTATION).sort(), ['BROKEN', 'DELIVERED']);
    assert.equal(edgeStatusPresentation('BROKEN')?.breakMark, true);
    assert.equal(edgeStatusPresentation('BROKEN')?.className, 'continuum-edge--broken');
    assert.equal(edgeStatusPresentation('DELIVERED')?.breakMark, false);
    assert.equal(edgeStatusPresentation('DELIVERED')?.className, 'continuum-edge--delivered');
});

test('an edge with no status, or one this build does not know, is drawn as a plain wire', () => {
    assert.equal(edgeStatusPresentation(undefined), undefined);
    assert.equal(edgeStatusPresentation('PENDING'), undefined);
});
