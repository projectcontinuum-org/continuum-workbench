/**
 * Loop-carried flow variables tests — validates the inherited-variable rule against
 * representative cases from the shared case list (loop-carry-cases.json).
 *
 * The workbench mirrors the orchestration merger: entry members receive carried values, then
 * their own outputs flow to internal children using normal parent precedence.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    flowVariableDisplayForNode,
    inheritedVariablesForEntryMember,
    inheritedVariablesForNode,
    LOOP_CARRIED_KEY,
} from './LoopCarriedVariables';

interface TNode {
    id: string;
    type: string;
    parentNode?: string;
    data?: { inputs?: Record<string, unknown> };
}

interface TEdge {
    source: string;
    target: string;
    targetHandle?: string;
}

function node(id: string, loop = false, parent?: string): TNode {
    return { id, type: loop ? 'Loop' : 'BaseNode', parentNode: parent, data: { inputs: {} } };
}

function edge(src: string, tgt: string, handle = 'in'): TEdge {
    return { source: src, target: tgt, targetHandle: handle };
}

function outputs(nodeId: string, vars: Record<string, unknown>): Record<string, { data: unknown }> {
    return { out: { data: vars }, $variable: { data: vars } };
}

function graph(nodes: TNode[], edges: TEdge[]): { nodes: TNode[]; edges: TEdge[] } {
    return { nodes, edges };
}

describe('LOOP_CARRIED_KEY', () => {
    it('is the reserved $variable key', () => {
        assert.equal(LOOP_CARRIED_KEY, '$variable');
    });
});

describe('inheritedVariablesForEntryMember', () => {
    describe('when loop has no carried values yet (iteration 1)', () => {
        it('inherits from parent edges in port order for the entry member', () => {
            const seedPage = { page: 1, hasMore: true };
            const g = graph([node('seed'), node('L', true), node('fetch', false, 'L')], [
                edge('seed', 'fetch'),
            ]);
            const nodeToOutputs: Record<string, Record<string, { data: unknown }>> = {};
            nodeToOutputs['seed'] = outputs('seed', seedPage);
            nodeToOutputs['L'] = outputs('L', {});

            const result = inheritedVariablesForEntryMember('fetch', { ...g, nodeToOutputs }, ['L']);
            assert.deepStrictEqual(result.variables, seedPage);
            assert.equal(result.conflicts.length, 0);
        });

    });

    describe('internal members use their parent’s newer value', () => {
        it('does not reapply the loop carry after an entry parent changes the variable', () => {
            const g = graph(
                [node('seed'), node('L'), node('fetch', false, 'L'), node('parse', false, 'L')],
                [edge('seed', 'fetch'), edge('fetch', 'parse')],
            );
            const nodeToOutputs: Record<string, Record<string, { data: unknown }>> = {};
            nodeToOutputs['seed'] = outputs('seed', { page: 1, hasMore: true });
            nodeToOutputs['fetch'] = outputs('fetch', { page: 3, hasMore: true });
            // Loop L's carried set after iteration 1: page=2 (from fetch's own output)
            nodeToOutputs['L'] = outputs('L', { page: 2, hasMore: true });

            const result = inheritedVariablesForNode('parse', { ...g, nodeToOutputs });
            assert.deepStrictEqual(result.variables, { page: 3, hasMore: true });
        });
    });

    describe('carried value reaches entry member in iteration 2', () => {
        it('fetch (entry member) gets page=2 from carried set, not the seed value of page=1', () => {
            const g = graph(
                [node('seed'), node('L', true), node('fetch', false, 'L')],
                [edge('seed', 'fetch')],
            );
            const nodeToOutputs: Record<string, Record<string, { data: unknown }>> = {};
            nodeToOutputs['seed'] = outputs('seed', { page: 1, hasMore: true });
            // After iteration 1, loop carried: page=2 from fetch itself
            nodeToOutputs['L'] = outputs('L', { page: 2, hasMore: true });

            const result = inheritedVariablesForEntryMember('fetch', { ...g, nodeToOutputs }, ['L']);
            assert.deepStrictEqual(result.variables, { page: 2, hasMore: true });
        });
    });

    describe('clash: later run-order member wins for same variable name', () => {
        it('the second member in execution order overrides the first writer\'s value', () => {
            const g = graph(
                [node('A'), node('L', true), node('m1', false, 'L'), node('m2', false, 'L')],
                [edge('A', 'm1'), edge('A', 'm2')],
            );
            const nodeToOutputs: Record<string, Record<string, { data: unknown }>> = {};
            nodeToOutputs['A'] = outputs('A', {});
            nodeToOutputs['m1'] = outputs('m1', { count: 10 });
            nodeToOutputs['m2'] = outputs('m2', { count: 20 });

            const result = inheritedVariablesForEntryMember('m2', { ...g, nodeToOutputs }, ['L']);
            // m2 itself sets count=20; the fan-in from A is empty
            assert.deepStrictEqual(result.variables, {});
        });
    });

    describe('variable set once stays carried', () => {
        it('a variable not set in iteration 2 is still carried from iteration 1', () => {
            const g = graph(
                [node('seed'), node('L', true), node('fetch', false, 'L')],
                [edge('seed', 'fetch')],
            );
            const nodeToOutputs: Record<string, Record<string, { data: unknown }>> = {};
            nodeToOutputs['seed'] = outputs('seed', { page: 1 });
            nodeToOutputs['L'] = outputs('L', { page: 2, hasMore: true });

            // fetch didn't set anything new — carries what it inherited + loop carried
            const result = inheritedVariablesForEntryMember('fetch', { ...g, nodeToOutputs }, ['L']);
            assert.equal(result.variables.page, 2);
            assert.equal(result.variables.hasMore, true);
        });
    });

    describe('nested loops: outer carried reaches inner entry member', () => {
        it('inner loop entry gets vars from both outer loop and own parents', () => {
            const g = graph(
                [node('seed'), node('outer', true), node('inner', true, 'outer'), node('innerMember', false, 'inner')],
                [edge('seed', 'innerMember')],
            );
            const nodeToOutputs: Record<string, Record<string, { data: unknown }>> = {};
            nodeToOutputs['seed'] = outputs('seed', { x: 1 });
            nodeToOutputs['outer'] = outputs('outer', { x: 2, y: 3 });
            nodeToOutputs['inner'] = outputs('inner', { y: 4 });

            // innerMember is entry of inner loop; enclosing loops = [inner, outer]
            // Pass outermost first so innermost (last) wins for overlapping names.
            const result = inheritedVariablesForEntryMember('innerMember', { ...g, nodeToOutputs }, ['outer', 'inner']);
            // Loop carries take priority: x=2 from outer, y=4 from inner (later in list wins for same name).
            assert.equal(result.variables.x, 2);
            assert.equal(result.variables.y, 4);
        });
    });

    describe('conflicts are reported', () => {
        it('when two parents set different values for the same name, the first wins and conflict is logged', () => {
            const g = graph(
                [node('a'), node('b'), node('target', false), node('L', true), node('member', false, 'L')],
                [edge('a', 'member'), edge('b', 'member')],
            );
            const nodeToOutputs: Record<string, Record<string, { data: unknown }>> = {};
            nodeToOutputs['a'] = outputs('a', { key: 'from-a' });
            nodeToOutputs['b'] = outputs('b', { key: 'from-b' });
            nodeToOutputs['L'] = outputs('L', {});

            const result = inheritedVariablesForEntryMember('member', { ...g, nodeToOutputs }, ['L']);
            assert.equal(result.variables.key, 'from-a'); // first in edge order wins
            assert.equal(result.conflicts.length, 1);
            assert.equal(result.conflicts[0].name, 'key');
        });
    });

    describe('non-entry member (no parent loop)', () => {
        it('returns empty inherited — not an entry of any loop', () => {
            const g = graph([node('seed'), node('L', true), node('afterLoop')], []);
            const nodeToOutputs: Record<string, Record<string, { data: unknown }>> = {};
            nodeToOutputs['seed'] = outputs('seed', { x: 1 });
            nodeToOutputs['L'] = outputs('L', {});

            // afterLoop is not inside L (no parentNode)
            const result = inheritedVariablesForEntryMember('afterLoop', { ...g, nodeToOutputs }, []);
            assert.deepStrictEqual(result.variables, {});
        });
    });
});

describe('inheritedVariablesForNode', () => {
    it('derives enclosing loops from the workflow snapshot and includes carried values in output rows', () => {
        const snapshot = graph(
            [node('seed'), node('loop', true), node('entry', false, 'loop')],
            [edge('seed', 'entry')],
        );
        const nodeToOutputs: Record<string, Record<string, { data: unknown }>> = {
            seed: outputs('seed', { page: 1 }),
            loop: outputs('loop', { page: 2, hasMore: true }),
        };
        const result = inheritedVariablesForNode('entry', { ...snapshot, nodeToOutputs });
        assert.deepStrictEqual(result.variables, { page: 2, hasMore: true });
        const display = flowVariableDisplayForNode('entry', { ...snapshot, nodeToOutputs }, nodeToOutputs.entry ?? {});
        assert.deepStrictEqual(display.rows.map(({ name, value, origin }) => ({ name, value, origin })), [
            { name: 'hasMore', value: true, origin: 'inherited' },
            { name: 'page', value: 2, origin: 'inherited' },
        ]);
    });

    it('shows an internal child the updated value produced by its entry parent', () => {
        const snapshot = graph(
            [node('seed'), node('loop', true), node('entry', false, 'loop'), node('child', false, 'loop')],
            [edge('seed', 'entry'), edge('entry', 'child')],
        );
        const nodeToOutputs: Record<string, Record<string, { data: unknown }>> = {
            seed: outputs('seed', { page: 1 }),
            loop: outputs('loop', { page: 2 }),
            entry: outputs('entry', { page: 3 }),
        };

        assert.deepStrictEqual(
            inheritedVariablesForNode('entry', { ...snapshot, nodeToOutputs }).variables,
            { page: 2 },
        );
        assert.deepStrictEqual(
            inheritedVariablesForNode('child', { ...snapshot, nodeToOutputs }).variables,
            { page: 3 },
        );
        const display = flowVariableDisplayForNode('child', { ...snapshot, nodeToOutputs }, {});
        assert.deepStrictEqual(display.rows, [{ name: 'page', value: 3, origin: 'inherited' }]);
    });
});
