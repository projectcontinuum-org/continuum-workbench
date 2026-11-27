/**
 * LoopPresentation tests — condition summary and loop-specific run message formatting.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    conditionSummary,
    conditionShortFormat,
    loopCollapsedWidth,
    loopConditionChipText,
    loopMemberCountLabel,
    loopNestingPresentation,
    loopNodeProgressMessage,
    loopRunStatusMessage,
    loopVariableChipText,
} from './LoopPresentation';

describe('conditionSummary', () => {
    it('truncates long text with ellipsis', () => {
        assert.equal(conditionSummary('vars["page"] < 10 && vars["hasMore"] == true', 20), 'vars["page"] < 10 &&…');
    });

    it('returns full text when within limit', () => {
        const text = 'vars["x"] < 10';
        assert.equal(conditionSummary(text, 50), text);
    });

    it('returns empty for null/empty input', () => {
        assert.equal(conditionSummary('', 20), '');
        assert.equal(conditionSummary(null as any, 20), '');
        assert.equal(conditionSummary(undefined as any, 20), '');
    });
});

describe('loopConditionChipText', () => {
    it('prefixes the condition and truncates long expressions', () => {
        assert.equal(
            loopConditionChipText('vars["hasMore"] == true', 15),
            'while vars["hasMore"]…',
        );
    });
});

describe('loopMemberCountLabel', () => {
    it('uses the singular form for one member', () => {
        assert.equal(loopMemberCountLabel(1), '1 node inside');
    });

    it('reports the number of hidden members', () => {
        assert.equal(loopMemberCountLabel(3), '3 nodes inside');
    });
});

describe('loopNestingPresentation', () => {
    it('keeps the outer fill subtle and increases nesting contrast in small steps', () => {
        const outer = loopNestingPresentation(0);
        const inner = loopNestingPresentation(1);
        const deeper = loopNestingPresentation(2);
        const deepest = loopNestingPresentation(3);
        assert.ok(outer.fillOpacity < 0.12);
        assert.ok(inner.fillOpacity - outer.fillOpacity < 0.02);
        assert.ok(deeper.fillOpacity - inner.fillOpacity < 0.02);
        assert.ok(deepest.fillOpacity - deeper.fillOpacity < 0.02);
        assert.ok(outer.borderOpacity < inner.borderOpacity);
        assert.ok(inner.borderOpacity < deeper.borderOpacity);
        assert.ok(deeper.borderOpacity < deepest.borderOpacity);
        assert.ok(outer.borderWidth < inner.borderWidth);
        assert.ok(inner.borderWidth < deeper.borderWidth);
        assert.ok(deeper.borderWidth < deepest.borderWidth);
    });

    it('caps deeper nesting styling and normalizes invalid depths', () => {
        assert.deepEqual(loopNestingPresentation(3), loopNestingPresentation(30));
        assert.equal(loopNestingPresentation(-1).level, 0);
        assert.equal(loopNestingPresentation(Number.NaN).level, 0);
    });
});

describe('loopVariableChipText', () => {
    it('formats strings as quoted JSON and retains primitive values', () => {
        assert.equal(loopVariableChipText('cursor', 'p3'), 'cursor = "p3"');
        assert.equal(loopVariableChipText('hasMore', true), 'hasMore = true');
        assert.equal(loopVariableChipText('pageCount', 3), 'pageCount = 3');
    });
});

describe('loopRunStatusMessage', () => {
    it('uses the backend completion wording for SUCCESS', () => {
        assert.equal(loopRunStatusMessage('SUCCESS', 3), 'Finished after 3 iterations');
    });

    it('uses singular "iteration" for count 1', () => {
        assert.equal(loopRunStatusMessage('SUCCESS', 1), 'Finished after 1 iteration');
    });

    it('says "Failed on iteration N"', () => {
        assert.equal(loopRunStatusMessage('FAILED', 5), 'Failed on iteration 5');
    });

    it('uses generic format for other statuses', () => {
        assert.equal(loopRunStatusMessage('RUNNING', 2), 'RUNNING at iteration 2');
    });
});

describe('loopNodeProgressMessage', () => {
    it('shows live iteration progress while the loop is busy', () => {
        assert.equal(loopNodeProgressMessage('BUSY', 'Iteration 2 of 5', 2, 5), 'Iteration 2 of 5');
    });

    it('uses counts when a busy loop has no backend message yet', () => {
        assert.equal(loopNodeProgressMessage('BUSY', undefined, 2, 5), 'Iteration 2 of 5');
    });

    it('normalizes successful completion grammar and retains other backend messages', () => {
        assert.equal(loopNodeProgressMessage('SUCCESS', 'Finished after 1 iterations'), 'Finished after 1 iteration');
        assert.equal(
            loopNodeProgressMessage('WARNING', 'Stopped at the limit of 3 iterations'),
            'Stopped at the limit of 3 iterations',
        );
    });
});

describe('conditionShortFormat', () => {
    it('formats a simple equality condition', () => {
        const parsed = { variable: 'hasMore', operator: '==', literalValue: true };
        assert.equal(conditionShortFormat(parsed as any), 'vars["hasMore"] == true');
    });

    it('formats a comparison with string literal', () => {
        const parsed = { variable: 'name', operator: '>=', literalValue: 'start' };
        assert.equal(conditionShortFormat(parsed as any), 'vars["name"] >= "start"');
    });

    it('returns null for null input', () => {
        assert.equal(conditionShortFormat(null), null);
    });
});

describe('loopCollapsedWidth', () => {
    it('shrinks wide loops and keeps narrow ones', () => {
        assert.equal(loopCollapsedWidth(1100), 300);
        assert.equal(loopCollapsedWidth(260), 260);
    });
});
