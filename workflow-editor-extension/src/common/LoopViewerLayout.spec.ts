import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NodeLike } from './LoopTopology';
import { LOOP_RUNTIME_MEMBER_OFFSET, reserveLoopRuntimeSummarySpace } from './LoopViewerLayout';

describe('reserveLoopRuntimeSummarySpace', () => {
    it('moves direct members below the runtime strip and recalculates nested absolute positions', () => {
        const nodes: NodeLike[] = [
            { id: 'outer', type: 'Loop', position: { x: 10, y: 20 } },
            { id: 'member', type: 'BaseNode', parentNode: 'outer', position: { x: 30, y: 40 } },
            { id: 'inner', type: 'Loop', parentNode: 'outer', position: { x: 100, y: 80 } },
            {
                id: 'inner-member',
                type: 'BaseNode',
                parentNode: 'inner',
                position: { x: 5, y: 6 },
                positionAbsolute: { x: 115, y: 106 },
            },
        ];

        const result = reserveLoopRuntimeSummarySpace(nodes, new Set(['outer']));
        assert.deepEqual(result[1].position, { x: 30, y: 40 + LOOP_RUNTIME_MEMBER_OFFSET });
        assert.deepEqual(result[2].position, { x: 100, y: 80 + LOOP_RUNTIME_MEMBER_OFFSET });
        assert.equal(result[1].positionAbsolute, undefined);
        assert.equal(result[2].positionAbsolute, undefined);
        assert.equal(result[3].positionAbsolute, undefined);
        assert.deepEqual(nodes[1].position, { x: 30, y: 40 });
        assert.deepEqual(nodes[3].positionAbsolute, { x: 115, y: 106 });
    });

    it('keeps members below the header and run-summary strip even if their saved y-position is zero', () => {
        const nodes: NodeLike[] = [
            { id: 'loop', type: 'Loop' },
            { id: 'member', type: 'BaseNode', parentNode: 'loop', position: { x: 0, y: 0 } },
        ];
        assert.deepEqual(
            reserveLoopRuntimeSummarySpace(nodes, new Set(['loop']))[1].position,
            { x: 0, y: 112 },
        );
    });

    it('does not alter positions when no Loop has a runtime summary', () => {
        const nodes: NodeLike[] = [
            { id: 'loop', type: 'Loop' },
            { id: 'member', type: 'BaseNode', parentNode: 'loop', position: { x: 10, y: 20 } },
        ];
        assert.deepEqual(reserveLoopRuntimeSummarySpace(nodes, new Set()), nodes);
    });
});
