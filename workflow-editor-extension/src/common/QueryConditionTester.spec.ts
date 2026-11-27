import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ControlElement, JsonSchema, TesterContext } from '@jsonforms/core';
import { queryConditionTester } from './QueryConditionTester';

describe('queryConditionTester', () => {
    it('matches the registered Loop condition control shape', () => {
        const conditionControl: ControlElement = {
            type: 'Control',
            scope: '#/properties/condition',
            options: { format: 'query', language: 'CEL' },
        };

        assert.equal(
            queryConditionTester(conditionControl, {} as JsonSchema, {} as TesterContext),
            10,
        );
    });

    it('does not claim an ordinary JSONForms control', () => {
        const ordinaryControl: ControlElement = {
            type: 'Control',
            scope: '#/properties/maxIterations',
        };

        assert.ok(
            queryConditionTester(ordinaryControl, {} as JsonSchema, {} as TesterContext) < 0,
        );
    });
});
