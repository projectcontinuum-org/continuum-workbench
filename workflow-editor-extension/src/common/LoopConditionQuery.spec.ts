/**
 * LoopConditionQuery tests — lossless adapter between CEL text and builder query trees.
 * Tests the round-trip: import → export must preserve supported expressions.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    fitsBuilder,
    builderFieldsForQuery,
    fromCel,
    parseCondition,
    formatCondition,
    operatorsFor,
    toCel,
    preserveBuilderLiteralTypes,
    SUPPORTED_SHAPE,
    DEFAULT_LOOP_CONDITION,
} from './LoopConditionQuery';
import type { LoopConditionGroup } from './LoopConditionQuery';
import { LiteralType } from './LoopConditionRules';
import builderCases from './loop-condition-builder-cases.json';

describe('DEFAULT_LOOP_CONDITION', () => {
    it('matches the expected default', () => {
        assert.equal(DEFAULT_LOOP_CONDITION, 'vars["hasMore"] == true');
    });
});

describe('SUPPORTED_SHAPE', () => {
    it('describes nested groups and negation', () => {
        assert.ok(SUPPORTED_SHAPE.includes('Nested'));
        assert.ok(SUPPORTED_SHAPE.includes('negation'));
        assert.ok(SUPPORTED_SHAPE.includes('flow variable'));
    });
});

describe('fitsBuilder', () => {
    it('imports and exports every shared CEL case without changing its expression', () => {
        for (const testCase of builderCases) {
            const imported = fromCel(testCase.text);
            assert.equal(fitsBuilder(testCase.text), testCase.fits, testCase.id);
            assert.equal(imported.fits, testCase.fits, testCase.id);
            if (imported.query && 'emitted' in testCase) {
                assert.equal(toCel(imported.query), testCase.emitted, testCase.id);
            }
            if ('query' in testCase && imported.query) {
                assert.deepStrictEqual(imported.query, testCase.query, testCase.id);
                assert.equal(toCel(testCase.query as LoopConditionGroup), testCase.emitted, testCase.id);
            }
        }
    });

    it('accepts a valid single comparison with vars["name"]', () => {
        assert.equal(fitsBuilder('vars["hasMore"] == true'), true);
    });
    it('accepts operators <, <=, >, >=', () => {
        assert.equal(fitsBuilder('vars["page"] < 10'), true);
        assert.equal(fitsBuilder('vars["count"] <= 5'), true);
        assert.equal(fitsBuilder('vars["score"] > 0'), true);
        assert.equal(fitsBuilder('vars["max"] >= 1'), true);
    });
    it('rejects a multi-variable condition', () => {
        assert.equal(fitsBuilder('vars["a"] && vars["b"]'), false);
    });
    it('rejects a macro expression', () => {
        assert.equal(fitsBuilder('vars["items"].all(x, x > 0)'), false);
    });
    it('rejects empty and whitespace-only input', () => {
        assert.equal(fitsBuilder(''), false);
        assert.equal(fitsBuilder('   '), false);
    });

    it('parses a single property selector without losing its variable name', () => {
        assert.equal(fitsBuilder('vars.hasMore == true'), true);
        const parsed = parseCondition('vars.hasMore == true');
        assert.equal(parsed?.variable, 'hasMore');
        assert.equal(parsed && formatCondition(parsed), 'vars["hasMore"] == true');
    });

    it('round-trips escaped quotes and backslashes in variable names and string values', () => {
        const text = 'vars["x\\\\path\\\"name"] == "say \\"hello\\"\\\\again"';
        const parsed = parseCondition(text);
        assert.equal(parsed?.variable, 'x\\path"name');
        assert.equal(parsed?.literalValue, 'say "hello"\\again');
        assert.equal(parsed && formatCondition(parsed), text);
    });

    it('imports the approved single-quoted key and parenthesized negative number forms', () => {
        assert.equal(fromCel('vars[\'x\'] != "a\\"b"').fits, true);
        assert.equal(fromCel('(vars["n"] > -1.5)').fits, true);
    });

    it('imports a negated single comparison as its equivalent builder operator', () => {
        const imported = fromCel('!(vars["c.d"] == "ab")');
        assert.equal(imported.fits, true);
        assert.equal(imported.query?.rules[0] && 'operator' in imported.query.rules[0]
            ? imported.query.rules[0].operator
            : null, '!=');
        assert.equal(imported.query && toCel(imported.query), 'vars["c.d"] != "ab"');
    });

    it('rejects malformed or chained variable selectors', () => {
        assert.equal(fitsBuilder('vars["unterminated] == true'), false);
        assert.equal(fitsBuilder('vars.hasMore.value == true'), false);
    });

    it('keeps edits to a nested group current instead of exporting the previous condition', () => {
        const query = fromCel(
            'vars["page"] > 1 && !(vars["state"] == "old" || vars["done"] == true)',
        ).query;
        assert.ok(query);
        const pageRule = query.rules[0];
        assert.ok(pageRule && !('rules' in pageRule));
        const edited: LoopConditionGroup = {
            ...query,
            rules: [
                pageRule,
                {
                    combinator: 'or',
                    not: true,
                    rules: [
                        { field: 'state', operator: '==', value: 'new' },
                        { field: 'done', operator: '==', value: true },
                    ],
                },
            ],
        };
        assert.equal(
            toCel(edited),
            'vars["page"] > 1 && !(vars["state"] == "new" || vars["done"] == true)',
        );
    });
});

describe('parseCondition', () => {
    it('parses a boolean comparison', () => {
        const result = parseCondition('vars["hasMore"] == true');
        assert.ok(result != null);
        assert.equal(result!.variable, 'hasMore');
        assert.equal(result!.operator, '==');
        assert.equal(result!.literalType, 'boolean');
        assert.equal(result!.literalValue, true);
    });
    it('parses an integer comparison', () => {
        const result = parseCondition('vars["page"] < 10');
        assert.ok(result != null);
        assert.equal(result!.variable, 'page');
        assert.equal(result!.operator, '<');
        assert.equal(result!.literalType, 'integer');
        assert.equal(result!.literalValue, 10);
    });
    it('parses a string comparison', () => {
        const result = parseCondition('vars["name"] == "hello"');
        assert.ok(result != null);
        assert.equal(result!.variable, 'name');
        assert.equal(result!.literalType, 'string');
        assert.equal(result!.literalValue, 'hello');
    });
    it('returns null for unrepresentable conditions', () => {
        assert.equal(parseCondition('vars["a"] && vars["b"]'), null);
        assert.equal(parseCondition('math.greatest(vars["a"], 1) > 0'), null);
    });
});

describe('formatCondition', () => {
    it('formats a boolean condition back to CEL text', () => {
        const input = 'vars["hasMore"] == true';
        const parsed = parseCondition(input);
        assert.ok(parsed != null);
        assert.equal(formatCondition(parsed), input);
    });
    it('round-trips an integer condition', () => {
        const input = 'vars["page"] < 10';
        const parsed = parseCondition(input);
        assert.ok(parsed != null);
        assert.equal(formatCondition(parsed), input);
    });
    it('escapes quotes in variable names', () => {
        const condition: any = { variable: 'x"y', operator: '==', literalType: 'boolean' as LiteralType, literalValue: true };
        const formatted = formatCondition(condition as any);
        assert.ok(formatted.includes('x\\"y'));
    });

    it('does not emit an incomplete builder rule and escapes serialized names and strings', () => {
        assert.equal(toCel({ combinator: 'and', rules: [{ field: '', operator: '==', value: true }] }), '');
        assert.equal(
            toCel({ combinator: 'and', rules: [{ field: 'x"y', operator: '==', value: 'say "hi"' }] }),
            'vars["x\\"y"] == "say \\"hi\\""',
        );
    });

    it('serializes edited boolean and numeric text as typed CEL literals', () => {
        const booleanQuery = preserveBuilderLiteralTypes(
            { combinator: 'and', rules: [{ field: 'hasMore', operator: '==', value: 'false' }] },
            { combinator: 'and', rules: [{ field: 'hasMore', operator: '==', value: true }] },
        );
        const numberQuery = preserveBuilderLiteralTypes(
            { combinator: 'and', rules: [{ field: 'page', operator: '<=', value: '12' }] },
            { combinator: 'and', rules: [{ field: 'page', operator: '<=', value: 10 }] },
        );
        const stringQuery = preserveBuilderLiteralTypes(
            { combinator: 'and', rules: [{ field: 'state', operator: '==', value: 'false' }] },
            { combinator: 'and', rules: [{ field: 'state', operator: '==', value: 'true' }] },
        );

        assert.equal(toCel(booleanQuery), 'vars["hasMore"] == false');
        assert.equal(toCel(numberQuery), 'vars["page"] <= 12');
        assert.equal(toCel(stringQuery), 'vars["state"] == "false"');
    });
});

describe('builderFieldsForQuery', () => {
    it('includes variable names and selects editors that preserve literal types', () => {
        const query = fromCel(
            'vars["hasMore"] == true && vars["pageCount"] < 10 && vars["cursor"] != "p3"',
        ).query!;
        assert.deepEqual(builderFieldsForQuery(query), [
            { name: 'hasMore', label: 'hasMore', valueEditorType: 'checkbox' },
            { name: 'pageCount', label: 'pageCount', valueEditorType: 'text', inputType: 'number' },
            { name: 'cursor', label: 'cursor', valueEditorType: 'text' },
        ]);
    });
});

describe('operatorsFor', () => {
    it('returns comparison operators for booleans', () => {
        assert.deepEqual(operatorsFor('boolean'), ['==', '!=']);
    });
    it('returns comparison operators for integers', () => {
        assert.deepEqual(operatorsFor('integer'), ['==', '!=', '<', '<=', '>', '>=']);
    });
});
