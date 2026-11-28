import { descendants, GraphLike, NodeLike } from './LoopTopology';

export const LOOP_RUNTIME_MEMBER_OFFSET = 84;
const LOOP_RUNTIME_CONTENT_START = 112;

/** Reserve readable space above run-view members without changing the saved workflow positions. */
export function reserveLoopRuntimeSummarySpace<T extends NodeLike>(
    nodes: ReadonlyArray<T>,
    loopsWithSummary: ReadonlySet<string>,
): T[] {
    const graph: GraphLike = { nodes, edges: [] };
    const recomputeAbsolutePositions = new Set<string>();
    loopsWithSummary.forEach((loopId) => {
        descendants(loopId, graph).forEach((nodeId) => recomputeAbsolutePositions.add(nodeId));
    });

    return nodes.map((node) => {
        const needsOffset = !!node.parentNode && loopsWithSummary.has(node.parentNode);
        const needsAbsolutePosition = recomputeAbsolutePositions.has(node.id);
        if (!needsOffset && !needsAbsolutePosition) return node as T;
        const position = node.position ?? { x: 0, y: 0 };
        return {
            ...node,
            ...(needsOffset ? {
                position: {
                    ...position,
                    y: Math.max(position.y + LOOP_RUNTIME_MEMBER_OFFSET, LOOP_RUNTIME_CONTENT_START),
                },
            } : {}),
            positionAbsolute: undefined,
        } as T;
    });
}
