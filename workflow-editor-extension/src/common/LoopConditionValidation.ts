/** Pure workflow update used to validate the loop condition currently being edited. */

import { absolutePosition, NodeLike } from './LoopTopology';

export interface ConditionNodeLike {
    id: string;
    parentNode?: string | null;
    position?: { x: number; y: number };
    positionAbsolute?: { x: number; y: number } | null;
    selected?: boolean | null;
    dragging?: boolean | null;
    data?: { properties?: Record<string, unknown> };
}

export interface ConditionWorkflowLike {
    nodes: ReadonlyArray<ConditionNodeLike>;
    edges: ReadonlyArray<unknown>;
}

export function withEditedLoopCondition<T extends ConditionWorkflowLike>(
    workflow: T,
    loopId: string,
    condition: string,
): T {
    const graph = { nodes: workflow.nodes as unknown as NodeLike[], edges: [] };
    return {
        ...workflow,
        nodes: workflow.nodes.map((node) => {
            const updated = node.id === loopId
                ? {
                    ...node,
                    data: {
                        ...node.data,
                        properties: {
                            ...node.data?.properties,
                            condition,
                        },
                    },
                }
                : node;
            return {
                ...updated,
                selected: node.selected ?? false,
                dragging: node.dragging ?? false,
                positionAbsolute: node.positionAbsolute ?? absolutePosition(node.id, graph),
            };
        }),
    } as T;
}
