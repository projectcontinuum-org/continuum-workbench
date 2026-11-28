/**
 * LoopTopology tests — structural checks for loop membership and cycle detection.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    collapsedView,
    directMembers,
    descendants,
    enclosingLoops,
    findDropTarget,
    innermostLoopOf,
    isLoopNode,
    orderParentFirst,
    wouldCreateCycle,
    collapsedLoopHandleId,
    absolutePositionFromParentChain,
    withLoopScopedEdgeClass,
    toRelativePositionFromParentChain,
} from './LoopTopology';

describe('isLoopNode', () => {
    it('recognises Loop type', () => {
        assert.equal(isLoopNode('Loop'), true);
    });
    it('rejects non-loop types', () => {
        assert.equal(isLoopNode('BaseNode'), false);
        assert.equal(isLoopNode('DummyNode'), false);
        assert.equal(isLoopNode(''), false);
    });
});

describe('innermostLoopOf', () => {
    it('returns undefined for a top-level node', () => {
        const graph = { nodes: [] as any[], edges: [] };
        assert.equal(innermostLoopOf('A', graph), undefined);
    });
});

describe('descendants', () => {
    it('returns empty for a loop with no members', () => {
        const graph = { nodes: [{ id: 'L1', type: 'Loop', data: null }], edges: [] };
        assert.equal(descendants('L1', graph).size, 0);
    });

    it('does not include descendants of unrelated sibling loops', () => {
        const graph = { nodes: [
            { id: 'L1', type: 'Loop' },
            { id: 'A', type: 'BaseNode', parentNode: 'L1' },
            { id: 'L2', type: 'Loop' },
            { id: 'B', type: 'BaseNode', parentNode: 'L2' },
        ], edges: [] };
        assert.deepStrictEqual([...descendants('L1', graph)], ['A']);
        assert.deepStrictEqual([...descendants('L2', graph)], ['B']);
    });

    it('includes only nested descendants in their containing scope', () => {
        const graph = { nodes: [
            { id: 'outer', type: 'Loop' },
            { id: 'inner', type: 'Loop', parentNode: 'outer' },
            { id: 'inside', type: 'BaseNode', parentNode: 'inner' },
            { id: 'sibling', type: 'Loop' },
        ], edges: [] };
        assert.deepStrictEqual([...descendants('outer', graph)], ['inner', 'inside']);
        assert.deepStrictEqual(enclosingLoops('inside', graph).map(({ loopId }) => loopId), ['outer', 'inner']);
    });
});

describe('wouldCreateCycle', () => {
    it('rejects a connection from a member to its own loop box', () => {
        const graph = { nodes: [{ id: 'L1', type: 'Loop' }, { id: 'N1', type: 'BaseNode', parentNode: 'L1' }], edges: [] };
        assert.equal(wouldCreateCycle('N1', 'L1', graph), true);
    });
    it('rejects a connection from a loop box to its member', () => {
        const graph = { nodes: [{ id: 'L1', type: 'Loop' }, { id: 'N1', type: 'BaseNode', parentNode: 'L1' }], edges: [] };
        assert.equal(wouldCreateCycle('L1', 'N1', graph), true);
    });

    it('rejects a cycle created by collapsing member nodes into their loop', () => {
        const graph = {
            nodes: [
                { id: 'L', type: 'Loop' },
                { id: 'X1', type: 'BaseNode', parentNode: 'L' },
                { id: 'X2', type: 'BaseNode', parentNode: 'L' },
                { id: 'Y', type: 'BaseNode' },
            ],
            edges: [{ source: 'X1', target: 'Y' }],
        };
        assert.equal(wouldCreateCycle('Y', 'X2', graph), true);
    });

    it('allows connections that do not cross unrelated loop scopes', () => {
        const graph = {
            nodes: [
                { id: 'L1', type: 'Loop' },
                { id: 'A', type: 'BaseNode', parentNode: 'L1' },
                { id: 'L2', type: 'Loop' },
                { id: 'B', type: 'BaseNode', parentNode: 'L2' },
            ],
            edges: [],
        };
        assert.equal(wouldCreateCycle('A', 'B', graph), false);
    });

    it('rejects a direct connection to a loop box', () => {
        const graph = { nodes: [{ id: 'L', type: 'Loop' }, { id: 'A', type: 'BaseNode' }], edges: [] };
        assert.equal(wouldCreateCycle('A', 'L', graph), true);
    });
});

describe('directMembers', () => {
    it('returns members directly inside a loop', () => {
        const nodes = [
            { id: 'L1', type: 'Loop' },
            { id: 'N1', type: 'BaseNode', parentNode: 'L1' },
            { id: 'N2', type: 'BaseNode', parentNode: 'L1' },
            { id: 'N3', type: 'BaseNode' },
        ];
        const graph = { nodes, edges: [] };
        const members = directMembers('L1', graph);
        assert.equal(members.size, 2);
        assert.ok(members.has('N1'));
        assert.ok(members.has('N2'));
        assert.ok(!members.has('N3'));
    });
});

describe('parent-chain position conversion', () => {
    const graph = {
        nodes: [
            {
                id: 'outer',
                type: 'Loop',
                position: { x: 300, y: 200 },
                positionAbsolute: { x: -300, y: -200 },
            },
            {
                id: 'inner',
                type: 'Loop',
                parentNode: 'outer',
                position: { x: 80, y: 60 },
                positionAbsolute: { x: -80, y: -60 },
            },
            {
                id: 'member',
                type: 'BaseNode',
                parentNode: 'inner',
                position: { x: 650, y: 400 },
                positionAbsolute: { x: -650, y: -400 },
            },
        ],
        edges: [],
    };

    it('sums nested relative positions and ignores stale cached absolute positions', () => {
        assert.deepStrictEqual(absolutePositionFromParentChain('member', graph), { x: 1030, y: 660 });
    });

    it('converts an absolute canvas point to coordinates relative to a nested parent', () => {
        assert.deepStrictEqual(
            toRelativePositionFromParentChain({ x: 1030, y: 660 }, 'inner', graph),
            { x: 650, y: 400 },
        );
    });
});

describe('collapsedView', () => {
    it('hides members and reattaches crossing edges only in the display view', () => {
        const nodes = [
            { id: 'L', type: 'Loop', position: { x: 0, y: 0 }, width: 300, height: 200, data: { collapsed: true } },
            { id: 'A', type: 'BaseNode', parentNode: 'L', position: { x: 20, y: 30 } },
            { id: 'B', type: 'BaseNode', position: { x: 500, y: 40 } },
        ];
        const edges: Array<{
            id: string;
            source: string;
            target: string;
            sourceHandle?: string;
            targetHandle?: string;
        }> = [
            { id: 'inside', source: 'A', target: 'A' },
            { id: 'out', source: 'A', target: 'B', sourceHandle: 'out' },
            { id: 'in', source: 'B', target: 'A', targetHandle: 'in' },
        ];
        const view = collapsedView(nodes, edges);
        assert.deepStrictEqual([...view.hiddenNodeIds], ['A']);
        assert.deepStrictEqual(view.displayEdges.map(({ source, target }) => [source, target]), [['L', 'B'], ['B', 'L']]);
        assert.equal(edges[1].source, 'A');
        assert.equal(view.displayEdges[0].sourceHandle, collapsedLoopHandleId('source', 'right'));
        assert.equal(view.displayEdges[1].targetHandle, collapsedLoopHandleId('target', 'right'));
    });

    it('routes collapsed display edges to the side facing the other endpoint', () => {
        const nodes = [
            { id: 'loop', type: 'Loop', position: { x: 100, y: 0 }, width: 300, height: 200, data: { collapsed: true } },
            { id: 'member', type: 'BaseNode', parentNode: 'loop', position: { x: 30, y: 40 } },
            { id: 'west', type: 'BaseNode', position: { x: -100, y: 20 } },
            { id: 'east', type: 'BaseNode', position: { x: 700, y: 20 } },
        ];
        const edges: Array<{
            id: string;
            source: string;
            target: string;
            sourceHandle?: string;
            targetHandle?: string;
        }> = [
            { id: 'member-west', source: 'member', target: 'west' },
            { id: 'west-member', source: 'west', target: 'member' },
            { id: 'member-east', source: 'member', target: 'east' },
            { id: 'east-member', source: 'east', target: 'member' },
        ];

        const view = collapsedView(nodes, edges);
        assert.deepStrictEqual(view.displayEdges.map(({ sourceHandle, targetHandle }) => [
            sourceHandle,
            targetHandle,
        ]), [
            [collapsedLoopHandleId('source', 'left'), undefined],
            [undefined, collapsedLoopHandleId('target', 'left')],
            [collapsedLoopHandleId('source', 'right'), undefined],
            [undefined, collapsedLoopHandleId('target', 'right')],
        ]);
        assert.equal(edges[0].source, 'member');
    });

    it('routes an outbound edge past a wide collapsed Loop from its right border', () => {
        const nodes = [
            { id: 'loop', type: 'Loop', position: { x: 400, y: 80 }, width: 1100, height: 330, data: { collapsed: true } },
            { id: 'member', type: 'BaseNode', parentNode: 'loop', position: { x: 720, y: 110 } },
            { id: 'after', type: 'BaseNode', position: { x: 1620, y: 180 } },
        ];
        const edges: Array<{ id: string; source: string; target: string; sourceHandle?: string }> = [
            { id: 'out', source: 'member', target: 'after' },
        ];
        const [outbound] = collapsedView(nodes, edges).displayEdges;
        assert.equal(outbound.source, 'loop');
        assert.equal(outbound.sourceHandle, collapsedLoopHandleId('source', 'right'));
    });
});

describe('withLoopScopedEdgeClass', () => {
    it('marks display edges touching loop members while preserving saved edge data', () => {
        const nodes = [
            { id: 'loop', type: 'Loop' },
            { id: 'inside', type: 'BaseNode', parentNode: 'loop' },
            { id: 'outside', type: 'BaseNode' },
            { id: 'unrelated', type: 'BaseNode' },
        ];
        const edges = [
            { id: 'crossing', source: 'inside', target: 'outside', className: 'existing' },
            { id: 'ordinary', source: 'outside', target: 'unrelated' },
        ];
        const displayEdges = withLoopScopedEdgeClass(nodes, edges);
        assert.equal(displayEdges[0].className, 'existing loop-scoped-edge');
        assert.equal(displayEdges[1].className, undefined);
        assert.equal(edges[0].className, 'existing');
    });
});

describe('editor ordering and drop target', () => {
    it('orders a loop before its members without changing sibling order', () => {
        const ordered = orderParentFirst([
            { id: 'member', type: 'BaseNode', parentNode: 'loop' },
            { id: 'loop', type: 'Loop' },
            { id: 'other', type: 'BaseNode' },
        ]);
        assert.deepStrictEqual(ordered.map(({ id }) => id), ['loop', 'member', 'other']);
    });

    it('selects the innermost expanded loop containing the drop point', () => {
        const graph = { nodes: [
            { id: 'outer', type: 'Loop', position: { x: 0, y: 0 }, width: 520, height: 320 },
            { id: 'inner', type: 'Loop', parentNode: 'outer', position: { x: 60, y: 60 }, width: 200, height: 140 },
        ], edges: [] };
        assert.equal(findDropTarget({ x: 100, y: 100 }, graph), 'inner');
        assert.equal(findDropTarget({ x: 10, y: 10 }, graph), 'outer');
    });
});
