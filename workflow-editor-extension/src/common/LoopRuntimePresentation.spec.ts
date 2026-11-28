import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loopRuntimeSummary } from './LoopRuntimePresentation';
import type { INodeToOutputsMap } from '@continuum/core';

function outputVariables(variables: Record<string, unknown>) {
    return { $variable: { status: 'SUCCESS' as const, contentType: 'application/json', data: variables } };
}

describe('loopRuntimeSummary', () => {
    it('shows carried values and attributes the condition variable to its member writer', () => {
        const graph = {
            nodes: [
                { id: 'loop', type: 'Loop', data: { title: 'Fetch until done', properties: { condition: 'vars["hasMore"] == true' } } },
                { id: 'fetch', type: 'BaseNode', parentNode: 'loop', data: { title: 'Fetch page' } },
                { id: 'parse', type: 'BaseNode', parentNode: 'loop', data: { title: 'Parse page' } },
                { id: 'outside', type: 'BaseNode', data: { title: 'Outside' } },
            ],
            edges: [{ source: 'fetch', target: 'parse' }],
        };
        const outputs = {
            loop: outputVariables({ hasMore: true, cursor: 'p3', pageCount: 3 }),
            fetch: outputVariables({ cursor: 'p3' }),
            parse: outputVariables({ hasMore: true, cursor: 'p3' }),
            outside: outputVariables({ hasMore: true }),
        } as unknown as INodeToOutputsMap;

        assert.deepStrictEqual(loopRuntimeSummary('loop', graph, outputs), {
            sourceLabel: 'Parse page',
            variables: [
                { name: 'cursor', value: 'p3' },
                { name: 'hasMore', value: true },
                { name: 'pageCount', value: 3 },
            ],
        });
    });

    it('does not render a runtime strip before carried run data exists', () => {
        const graph = {
            nodes: [{ id: 'loop', type: 'Loop', data: { properties: { condition: 'vars["hasMore"] == true' } } }],
            edges: [],
        };
        assert.equal(loopRuntimeSummary('loop', graph, {}), undefined);
        assert.equal(
            loopRuntimeSummary('loop', graph, { loop: outputVariables({}) } as unknown as INodeToOutputsMap),
            undefined,
        );
    });
});
