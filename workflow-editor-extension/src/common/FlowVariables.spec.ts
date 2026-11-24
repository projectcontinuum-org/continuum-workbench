import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    dataPortIds,
    deepEqual,
    type FlowGraphLike,
    flowVariableRows,
    inheritedFlowVariables,
    type NodeToOutputsLike,
    ownFlowVariables,
} from './FlowVariables';

const DATA = { data: '{remote}run/node/output.out-1.parquet' };

/** Outputs of a finished node: one data port, plus `$variable` when it set any. */
function completed(own: Record<string, unknown> = {}) {
    return Object.keys(own).length === 0 ? { 'out-1': DATA } : { 'out-1': DATA, $variable: { data: own } };
}

function graphNode(id: string, inputs: string[] = []) {
    return { id, data: { inputs: inputs.length === 0 ? null : Object.fromEntries(inputs.map((port) => [port, {}])) } };
}

const CHAIN: FlowGraphLike = {
    nodes: [graphNode('A'), graphNode('B', ['in-1']), graphNode('C', ['in-1'])],
    edges: [
        { source: 'A', target: 'B', targetHandle: 'in-1' },
        { source: 'B', target: 'C', targetHandle: 'in-1' },
    ],
};

/** A feeds B and C; B feeds D's first input, C its second. Edges listed second-port-first on purpose. */
const DIAMOND: FlowGraphLike = {
    nodes: [graphNode('A'), graphNode('B', ['in-1']), graphNode('C', ['in-1']), graphNode('D', ['in-1', 'in-2'])],
    edges: [
        { source: 'C', target: 'D', targetHandle: 'in-2' },
        { source: 'A', target: 'B', targetHandle: 'in-1' },
        { source: 'A', target: 'C', targetHandle: 'in-1' },
        { source: 'B', target: 'D', targetHandle: 'in-1' },
    ],
};

test('ownFlowVariables reads $variable and ignores anything that is not a JSON object', () => {
    assert.deepEqual(ownFlowVariables(undefined), {});
    assert.deepEqual(ownFlowVariables({ 'out-1': DATA }), {});
    assert.deepEqual(ownFlowVariables({ $variable: { data: 'text' } }), {});
    assert.deepEqual(ownFlowVariables({ $variable: { data: [1, 2] } }), {});
    assert.deepEqual(ownFlowVariables({ $variable: { data: null } }), {});
    assert.deepEqual(ownFlowVariables({ $variable: { data: { x: 1, gone: null, nested: { a: 1 } } } }), { x: 1, nested: { a: 1 } });
});

test('dataPortIds lists data ports and $error first, never $variable or other system keys', () => {
    assert.deepEqual(dataPortIds({ 'out-1': DATA, $variable: { data: {} }, 'out-2': DATA }), ['out-1', 'out-2']);
    assert.deepEqual(dataPortIds({ $variable: { data: {} }, $error: { data: 'boom' } }), ['$error']);
    assert.deepEqual(dataPortIds({ $custom: DATA }), []);
    assert.deepEqual(dataPortIds(undefined), []);
});

test("a grandparent's variable reaches the grandchild through a node that set nothing", () => {
    const outputs: NodeToOutputsLike = { A: completed({ x: 1 }), B: completed() };

    const result = inheritedFlowVariables('C', CHAIN, outputs);

    assert.deepEqual(result.variables, { x: 1 });
    assert.deepEqual(result.conflicts, []);
});

test('a nearer ancestor overrides an older value and adds its own', () => {
    const outputs: NodeToOutputsLike = { A: completed({ x: 1, keep: 'a' }), B: completed({ x: 10, y: 2 }) };

    assert.deepEqual(inheritedFlowVariables('C', CHAIN, outputs).variables, { x: 10, keep: 'a', y: 2 });
    assert.deepEqual(inheritedFlowVariables('B', CHAIN, outputs).variables, { x: 1, keep: 'a' });
    assert.deepEqual(inheritedFlowVariables('A', CHAIN, outputs).variables, {});
});

test('fan-in keeps the value from the lowest declared input port and reports the conflict', () => {
    const outputs: NodeToOutputsLike = { A: completed(), B: completed({ k: 'from-B' }), C: completed({ k: 'from-C' }) };

    const result = inheritedFlowVariables('D', DIAMOND, outputs);

    assert.deepEqual(result.variables, { k: 'from-B' });
    assert.deepEqual(result.conflicts, [{ name: 'k', keptFromNodeId: 'B', ignoredFromNodeId: 'C' }]);
});

test('identical values arriving by two paths merge without a conflict', () => {
    const outputs: NodeToOutputsLike = {
        A: completed({ shared: { list: [1, 2], flag: true } }),
        B: completed({ same: { a: 1, b: 2 } }),
        C: completed({ same: { b: 2, a: 1 } }),
    };

    const result = inheritedFlowVariables('D', DIAMOND, outputs);

    assert.deepEqual(result.variables, { shared: { list: [1, 2], flag: true }, same: { a: 1, b: 2 } });
    assert.deepEqual(result.conflicts, []);
});

test('only conflicts at the node itself are reported', () => {
    const extended: FlowGraphLike = {
        nodes: [...DIAMOND.nodes, graphNode('E', ['in-1'])],
        edges: [...DIAMOND.edges, { source: 'D', target: 'E', targetHandle: 'in-1' }],
    };
    const outputs: NodeToOutputsLike = { A: completed(), B: completed({ k: 'from-B' }), C: completed({ k: 'from-C' }), D: completed() };

    const result = inheritedFlowVariables('E', extended, outputs);

    assert.deepEqual(result.variables, { k: 'from-B' });
    assert.deepEqual(result.conflicts, []);
});

test('edges into undeclared ports are ordered by target handle, then source', () => {
    const graph: FlowGraphLike = {
        nodes: [graphNode('P'), graphNode('Q'), graphNode('T')],
        edges: [
            { source: 'P', target: 'T', targetHandle: 'b' },
            { source: 'Q', target: 'T', targetHandle: 'a' },
        ],
    };
    const outputs: NodeToOutputsLike = { P: completed({ k: 'P' }), Q: completed({ k: 'Q' }) };

    assert.deepEqual(inheritedFlowVariables('T', graph, outputs).variables, { k: 'Q' });
});

test('a node whose ancestors have no outputs yet inherits nothing', () => {
    assert.deepEqual(inheritedFlowVariables('D', DIAMOND, {}), { variables: {}, conflicts: [] });
});

test('rows mark each variable as set, inherited or overridden, sorted by name', () => {
    const rows = flowVariableRows({ x: 10, z: 3 }, { x: 1, y: 2 });

    assert.deepEqual(rows, [
        { name: 'x', value: 10, origin: 'overridden', inheritedValue: 1 },
        { name: 'y', value: 2, origin: 'inherited' },
        { name: 'z', value: 3, origin: 'set' },
    ]);
});

test('deepEqual compares decoded JSON structurally', () => {
    assert.equal(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }), true);
    assert.equal(deepEqual({ a: 1 }, { a: 1, b: 2 }), false);
    assert.equal(deepEqual([1, 2], [2, 1]), false);
    assert.equal(deepEqual(1, '1'), false);
    assert.equal(deepEqual(null, {}), false);
});
