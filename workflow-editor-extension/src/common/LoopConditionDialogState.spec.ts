/**
 * LoopConditionDialogState tests — pure mode-decision, toggle, and validation logic.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    initialMode,
    canToggleToBuilder,
    builderToggleDisabledReason,
    replaceAction,
    conditionRequiredMessage,
    conditionIssuesFor,
    notCheckedResponse,
} from './LoopConditionDialogState';

describe('initialMode', () => {
    const fits = (text: string) => text === 'vars["hasMore"] == true';

    it('opens a valid initial CEL condition in builder mode', () => {
        assert.deepStrictEqual(initialMode('vars["hasMore"] == true', fits), { initialMode: 'builder' });
    });

    it('returns cel when condition does not fit builder shape', () => {
        assert.deepStrictEqual(initialMode('vars["page"] < 10 && vars["count"] > 0', fits), { initialMode: 'cel' });
    });

    it('returns cel for empty string', () => {
        assert.deepStrictEqual(initialMode('', fits), { initialMode: 'cel' });
    });
});

describe('canToggleToBuilder', () => {
    it('allows toggle for a simple condition', () => {
        const result = canToggleToBuilder('vars["x"] < 10');
        assert.equal(result.disabled, false);
        assert.equal(result.targetMode, 'builder');
        assert.equal(result.disabledReason, null);
    });

    it('allows toggle when text is default', () => {
        const result = canToggleToBuilder('vars["hasMore"] == true');
        assert.equal(result.targetMode, 'builder');
    });

    it('disables the builder for CEL-only text with the user-facing reason', () => {
        const result = canToggleToBuilder('vars["items"].exists(i, i > 2)');
        assert.equal(result.disabled, true);
        assert.equal(result.disabledReason, 'This condition uses CEL features the builder cannot show');
    });

    it('keeps an empty condition in CEL mode and requires text before switching', () => {
        assert.deepStrictEqual(initialMode('', () => false), { initialMode: 'cel' });
        assert.equal(canToggleToBuilder('   ').disabled, false);
        assert.equal(canToggleToBuilder('   ').disabledReason, null);
        assert.equal(conditionRequiredMessage(''), 'Condition is required.');
        assert.equal(conditionRequiredMessage('vars["x"] == true'), null);
        assert.equal(builderToggleDisabledReason(''), null);
        assert.equal(builderToggleDisabledReason('   '), null);
        assert.equal(
            builderToggleDisabledReason('vars["items"].exists(i, i > 2)'),
            'This condition uses CEL features the builder cannot show',
        );
    });
});

describe('replaceAction', () => {
    it('returns the default builder condition after explicit replacement confirmation', () => {
        const result = replaceAction();
        assert.equal(result.mode, 'builder');
        assert.equal(result.newText, 'vars["hasMore"] == true');
    });
});

describe('conditionIssuesFor', () => {
    it('filters issues for a specific loop id and condition property', () => {
        const issues = [
            { node: 'L', property: 'condition', message: 'Invalid CEL expression', column: 5 },
            { node: 'L', property: 'maxIterations', message: 'Must be positive', column: 0 },
            { node: 'other', property: 'condition', message: 'Unrelated issue', column: 0 },
        ];
        const filtered = conditionIssuesFor(issues, 'L');
        assert.equal(filtered.length, 1);
        assert.equal(filtered[0].message, 'Invalid CEL expression');
    });

    it('returns empty when no matching issues', () => {
        const issues = [
            { node: 'other', property: 'condition', message: 'Wrong loop', column: 0 },
        ];
        assert.deepStrictEqual(conditionIssuesFor(issues, 'L'), []);
    });
});

describe('notCheckedResponse', () => {
    it('returns not-checked status with empty issues', () => {
        const response = notCheckedResponse();
        assert.equal(response.status, 'not-checked');
        assert.equal(response.issues.length, 0);
    });
});
