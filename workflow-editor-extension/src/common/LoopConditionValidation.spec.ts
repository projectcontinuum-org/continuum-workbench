import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withEditedLoopCondition } from './LoopConditionValidation';

describe('withEditedLoopCondition', () => {
    it('updates only the selected loop and does not mutate the workflow snapshot', () => {
        const workflow = {
            id: 'workflow',
            nodes: [
                { id: 'loop', data: { properties: { condition: 'old', maxIterations: 20 } } },
                { id: 'other', data: { properties: { condition: 'untouched' } } },
            ],
            edges: [{ source: 'a', target: 'b' }],
        };
        const updated = withEditedLoopCondition(workflow, 'loop', 'vars["ready"] == true');
        assert.equal(updated.nodes[0].data?.properties?.condition, 'vars["ready"] == true');
        assert.equal(updated.nodes[0].data?.properties?.maxIterations, 20);
        assert.equal(updated.nodes[1].data?.properties?.condition, 'untouched');
        assert.equal(workflow.nodes[0].data?.properties?.condition, 'old');
        assert.deepStrictEqual(updated.edges, workflow.edges);
    });

    it('defaults React Flow transient fields and computes absolute positions for API validation', () => {
        const workflow = {
            id: 'workflow',
            nodes: [
                {
                    id: 'loop',
                    type: 'Loop',
                    position: { x: 100, y: 200 },
                    selected: undefined,
                    dragging: undefined,
                    positionAbsolute: null,
                    data: { properties: {} },
                },
                {
                    id: 'member',
                    type: 'BaseNode',
                    parentNode: 'loop',
                    position: { x: 15, y: 25 },
                    data: { properties: {} },
                },
                { id: 'existing', position: { x: 9, y: 12 }, positionAbsolute: { x: 9, y: 12 }, selected: true, dragging: true },
            ],
            edges: [],
        };
        const updated = withEditedLoopCondition(workflow, 'loop', 'vars["ready"] == true');
        assert.equal(updated.nodes[0].selected, false);
        assert.equal(updated.nodes[0].dragging, false);
        assert.deepEqual(updated.nodes[0].positionAbsolute, { x: 100, y: 200 });
        assert.deepEqual(updated.nodes[1].positionAbsolute, { x: 115, y: 225 });
        assert.equal(updated.nodes[2].selected, true);
        assert.equal(updated.nodes[2].dragging, true);
        assert.deepEqual(updated.nodes[2].positionAbsolute, { x: 9, y: 12 });
    });
});
