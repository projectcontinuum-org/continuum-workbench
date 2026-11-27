import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    deleteSelectedGraph,
    loopDisplaySize,
    loopMinimumSize,
    loopStoredSize,
    moveDraggedNode,
    persistLoopResize,
} from './LoopCanvasOperations';
import { findDropTarget, NodeLike } from './LoopTopology';

const loopGraph: NodeLike[] = [
    { id: 'loop', type: 'Loop', position: { x: 10, y: 20 }, width: 520, height: 320, style: { width: 520, height: 320 } },
    { id: 'member', type: 'BaseNode', parentNode: 'loop', position: { x: 400, y: 120 }, width: 300, height: 80 },
    { id: 'nested', type: 'Loop', parentNode: 'loop', position: { x: 40, y: 40 }, width: 200, height: 140 },
    { id: 'nested-member', type: 'BaseNode', parentNode: 'nested', position: { x: 20, y: 20 }, width: 80, height: 30 },
    { id: 'outside', type: 'BaseNode', position: { x: 800, y: 20 } },
];

describe('persistLoopResize', () => {
    it('saves dimensions in node and style fields used by workflow serialization', () => {
        const resized = persistLoopResize(loopGraph, 'loop', { width: 760, height: 440 });
        const loop = resized.find((node) => node.id === 'loop');
        assert.equal(loop?.width, 760);
        assert.equal(loop?.height, 440);
        assert.deepEqual(loop?.style, { width: 760, height: 440 });
    });

    it('keeps resize minimums large enough for direct members', () => {
        assert.deepEqual(loopMinimumSize('loop', { nodes: loopGraph, edges: [] }), { width: 724, height: 272 });
    });

    it('uses persisted dimensions when checking loop membership bounds', () => {
        const resized = persistLoopResize(loopGraph, 'loop', { width: 760, height: 440 });
        assert.equal(findDropTarget({ x: 700, y: 420 }, { nodes: resized, edges: [] }), 'loop');
        assert.equal(findDropTarget({ x: 780, y: 420 }, { nodes: resized, edges: [] }), undefined);
    });

    it('uses stored expanded dimensions while growing to fit direct member bounds', () => {
        assert.deepEqual(loopDisplaySize('loop', { nodes: loopGraph, edges: [] }), {
            width: 724,
            height: 320,
        });
    });

    it('uses the default expanded dimensions when none are stored', () => {
        const nodes: NodeLike[] = [{ id: 'loop', type: 'Loop' }];
        assert.deepEqual(loopDisplaySize('loop', { nodes, edges: [] }), { width: 520, height: 320 });
    });

    it('uses saved/default dimensions in the editor instead of growing with member bounds', () => {
        assert.deepEqual(loopStoredSize('loop', { nodes: loopGraph, edges: [] }), {
            width: 520,
            height: 320,
        });
        const nodes: NodeLike[] = [{ id: 'loop', type: 'Loop' }];
        assert.deepEqual(loopStoredSize('loop', { nodes, edges: [] }), { width: 520, height: 320 });
    });
});

describe('deleteSelectedGraph', () => {
    it('moves members to absolute canvas positions when keeping them', () => {
        const result = deleteSelectedGraph(loopGraph, [], new Set(['loop']), 'keep-members');
        const member = result.nodes.find((node) => node.id === 'member');
        const nestedLoop = result.nodes.find((node) => node.id === 'nested');
        const nestedMember = result.nodes.find((node) => node.id === 'nested-member');
        assert.equal(result.nodes.some((node) => node.id === 'loop'), false);
        assert.equal(member?.parentNode, undefined);
        assert.deepEqual(member?.position, { x: 410, y: 140 });
        assert.equal(nestedLoop?.parentNode, undefined);
        assert.deepEqual(nestedLoop?.position, { x: 50, y: 60 });
        assert.equal(nestedMember?.parentNode, 'nested');
    });

    it('deletes every nested member and connected edge when removing members', () => {
        const result = deleteSelectedGraph(loopGraph, [
            { source: 'member', target: 'outside' },
            { source: 'outside', target: 'nested-member' },
        ], new Set(['loop']), 'delete-members');
        assert.deepEqual(result.nodes.map((node) => node.id), ['outside']);
        assert.deepEqual(result.edges, []);
    });
});

describe('moveDraggedNode', () => {
    for (const [direction, absoluteDropPosition] of [
        ['right', { x: 540, y: 120 }],
        ['below', { x: 100, y: 360 }],
        ['left', { x: -100, y: 120 }],
        ['above', { x: 100, y: -60 }],
    ] as const) {
        it(`unparents a member dragged ${direction} without changing the saved loop size`, () => {
            const nodes: NodeLike[] = [
                { id: 'loop', type: 'Loop', position: { x: 10, y: 20 }, width: 520, height: 320 },
                { id: 'member', type: 'BaseNode', parentNode: 'loop', position: { x: 20, y: 20 }, width: 80, height: 30 },
            ];
            const start = nodes.map((node) => ({ ...node }));
            const dragged = {
                ...nodes[1],
                position: { x: absoluteDropPosition.x - 10, y: absoluteDropPosition.y - 20 },
                positionAbsolute: { x: -900, y: -900 },
            };
            const result = moveDraggedNode(nodes, [], dragged, start);
            const moved = result.nodes.find((node) => node.id === 'member');
            assert.equal(moved?.parentNode, undefined);
            assert.deepEqual(moved?.position, absoluteDropPosition);
            assert.deepEqual(loopStoredSize('loop', { nodes: result.nodes, edges: [] }), {
                width: 520,
                height: 320,
            });
        });
    }

    it('uses the dragged relative position instead of a stale cached absolute position', () => {
        const nodes: NodeLike[] = [
            { id: 'loop', type: 'Loop', position: { x: 10, y: 20 }, width: 520, height: 320 },
            {
                id: 'member',
                type: 'BaseNode',
                parentNode: 'loop',
                position: { x: 20, y: 20 },
                positionAbsolute: { x: 30, y: 40 },
                width: 80,
                height: 30,
            },
            { id: 'sibling', type: 'BaseNode', position: { x: -200, y: 40 }, width: 100, height: 50 },
        ];
        const dragged = { ...nodes[1], position: { x: -210, y: 20 } };
        const result = moveDraggedNode(nodes, [], dragged, nodes.map((node) => ({ ...node })));
        const moved = result.nodes.find((node) => node.id === 'member');
        assert.equal(moved?.parentNode, undefined);
        assert.deepEqual(moved?.position, { x: -200, y: 40 });
    });

    it('unparents a member dropped outside a loop with a stale cached absolute position', () => {
        const nodes: NodeLike[] = [
            {
                id: 'loop',
                type: 'Loop',
                position: { x: 380, y: 120 },
                positionAbsolute: { x: 0, y: 0 },
                width: 520,
                height: 320,
            },
            {
                id: 'seed',
                type: 'BaseNode',
                position: { x: 60, y: 200 },
                width: 172,
                height: 36,
            },
            {
                id: 'member',
                type: 'BaseNode',
                parentNode: 'loop',
                position: { x: -320, y: 68 },
                positionAbsolute: { x: 0, y: 0 },
                width: 172,
                height: 36,
            },
        ];
        const dragged = { ...nodes[2], position: { x: -320, y: 68 } };
        const result = moveDraggedNode(
            nodes,
            [{ source: 'seed', target: 'member' }],
            dragged,
            nodes.map((node) => ({ ...node })),
        );
        const moved = result.nodes.find((node) => node.id === 'member');

        assert.equal(moved?.parentNode, undefined);
        assert.deepEqual(moved?.position, { x: 60, y: 188 });
    });

    it('preserves the final canvas point when unparenting from nested loops with stale cached positions', () => {
        const nodes: NodeLike[] = [
            {
                id: 'outer',
                type: 'Loop',
                position: { x: 300, y: 200 },
                positionAbsolute: { x: -300, y: -200 },
                width: 520,
                height: 320,
            },
            {
                id: 'inner',
                type: 'Loop',
                parentNode: 'outer',
                position: { x: 80, y: 60 },
                positionAbsolute: { x: -80, y: -60 },
                width: 200,
                height: 140,
            },
            {
                id: 'member',
                type: 'BaseNode',
                parentNode: 'inner',
                position: { x: 650, y: 400 },
                positionAbsolute: { x: -650, y: -400 },
                width: 80,
                height: 30,
            },
        ];
        const dragged = {
            ...nodes[2],
            position: { x: 650, y: 400 },
            positionAbsolute: { x: -1000, y: -1000 },
        };
        const result = moveDraggedNode(nodes, [], dragged, nodes.map((node) => ({ ...node })));
        const moved = result.nodes.find((node) => node.id === 'member');

        assert.equal(moved?.parentNode, undefined);
        assert.deepEqual(moved?.position, { x: 1030, y: 660 });
    });

    it('keeps the node outside loops when the proposed membership creates a cycle', () => {
        const nodes: NodeLike[] = [
            { id: 'loop', type: 'Loop', position: { x: 0, y: 0 }, width: 520, height: 320 },
            { id: 'inside', type: 'BaseNode', parentNode: 'loop', position: { x: 20, y: 20 } },
            { id: 'outside', type: 'BaseNode', position: { x: 700, y: 0 } },
            { id: 'middle', type: 'BaseNode', position: { x: 600, y: 100 } },
        ];
        const start = nodes.map((node) => ({ ...node }));
        const dragged = { ...nodes[2], position: { x: 100, y: 100 } };
        const result = moveDraggedNode(nodes, [
            { source: 'inside', target: 'middle' },
            { source: 'middle', target: 'outside' },
        ], dragged, start);
        assert.equal(result.refused, true);
        assert.equal(result.nodes.find((node) => node.id === 'outside')?.parentNode, undefined);
        assert.deepEqual(result.nodes.find((node) => node.id === 'outside')?.position, { x: 700, y: 0 });
    });
});
