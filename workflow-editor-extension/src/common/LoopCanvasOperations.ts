import {
    absolutePosition,
    absolutePositionFromParentChain,
    descendants,
    directMembers,
    findDropTarget,
    GraphLike,
    hasCycleInGraph,
    NodeLike,
    orderParentFirst,
    Point,
    toRelativePositionFromParentChain,
} from './LoopTopology';

export type LoopDeleteChoice = 'delete-members' | 'keep-members';

export interface LoopSize {
    width: number;
    height: number;
}

export interface LoopGraph<T extends NodeLike, E extends GraphLike['edges'][number]> {
    nodes: T[];
    edges: E[];
}

/** Reparents a dragged node to the smallest containing Loop, or restores its prior membership on a cycle. */
export function moveDraggedNode<T extends NodeLike, E extends GraphLike['edges'][number]>(
    nodes: T[],
    edges: E[],
    draggedNode: T,
    startNodes: T[],
): { nodes: T[]; refused: boolean } {
    const graph = { nodes, edges };
    const before = startNodes.find((node) => node.id === draggedNode.id);
    const currentNodes = nodes.map((node) => node.id === draggedNode.id ? draggedNode : node);
    const positionGraph = {
        nodes: currentNodes.map((node) => node.id === draggedNode.id
            ? { ...node, positionAbsolute: undefined }
            : node),
        edges,
    };
    const absolute = absolutePositionFromParentChain(draggedNode.id, positionGraph);
    const excluded = new Set([draggedNode.id, ...descendants(draggedNode.id, graph)]);
    const center = nodeCenter(draggedNode, absolute);
    const parentNode = findDropTarget(center, positionGraph, excluded);
    const proposed = orderParentFirst(currentNodes.map((node) => node.id === draggedNode.id
        ? {
            ...node,
            parentNode,
            position: toRelativePositionFromParentChain(absolute, parentNode, positionGraph),
            positionAbsolute: undefined,
        } as T
        : node));

    if (!hasCycleInGraph({ nodes: proposed, edges })) {
        return { nodes: proposed, refused: false };
    }
    return { nodes: restoreMembership(nodes, before), refused: true };
}

function nodeCenter(node: NodeLike, absolute: Point): Point {
    const width = nodeDimension(node.width, node.style?.width, node.type === 'Loop' ? 520 : 172);
    const height = nodeDimension(node.height, node.style?.height, node.type === 'Loop' ? 320 : 36);
    return { x: absolute.x + width / 2, y: absolute.y + height / 2 };
}

function restoreMembership<T extends NodeLike>(nodes: T[], before?: T): T[] {
    if (!before) return nodes;
    return nodes.map((node) => node.id === before.id
        ? { ...node, parentNode: before.parentNode, position: before.position, positionAbsolute: undefined } as T
        : node);
}

/** Returns the minimum expanded dimensions that keep every direct member inside the loop box. */
export function loopMinimumSize(loopId: string, graph: GraphLike): LoopSize {
    const members = directMembers(loopId, graph);
    const memberNodes = graph.nodes.filter((node) => members.has(node.id));
    const contentWidth = Math.max(0, ...memberNodes.map((node) =>
        (node.position?.x ?? 0) + nodeDimension(node.width, node.style?.width, 172)));
    const contentHeight = Math.max(0, ...memberNodes.map((node) =>
        (node.position?.y ?? 0) + nodeDimension(node.height, node.style?.height, 36)));
    return { width: Math.max(240, contentWidth + 24), height: Math.max(120, contentHeight + 72) };
}

/** Use persisted expanded dimensions, but never let the member bounds overflow the rendered box. */
export function loopDisplaySize(loopId: string, graph: GraphLike): LoopSize {
    const loop = graph.nodes.find((node) => node.id === loopId);
    const minimum = loopMinimumSize(loopId, graph);
    return {
        width: Math.max(nodeDimension(loop?.width, loop?.style?.width, 520), minimum.width),
        height: Math.max(nodeDimension(loop?.height, loop?.style?.height, 320), minimum.height),
    };
}

/** Returns saved/default dimensions without growing an editor box to follow a moving member. */
export function loopStoredSize(loopId: string, graph: GraphLike): LoopSize {
    const loop = graph.nodes.find((node) => node.id === loopId);
    return {
        width: nodeDimension(loop?.width, loop?.style?.width, 520),
        height: nodeDimension(loop?.height, loop?.style?.height, 320),
    };
}

/** Persists React Flow resize dimensions in both the node fields and its serialized style. */
export function persistLoopResize<T extends NodeLike>(nodes: T[], loopId: string, size: LoopSize): T[] {
    return nodes.map((node) => node.id === loopId
        ? { ...node, width: size.width, height: size.height, style: { ...node.style, ...size } } as T
        : node);
}

/** Removes selected nodes and applies the explicit policy for members of selected loops. */
export function deleteSelectedGraph<T extends NodeLike, E extends GraphLike['edges'][number]>(
    nodes: T[],
    edges: E[],
    selectedIds: ReadonlySet<string>,
    choice: LoopDeleteChoice,
): LoopGraph<T, E> {
    const graph: GraphLike = { nodes, edges };
    const selectedLoops = nodes.filter((node) => selectedIds.has(node.id) && node.type === 'Loop');
    const deleteIds = new Set(selectedIds);
    if (choice === 'delete-members') {
        selectedLoops.forEach((loop) => descendants(loop.id, graph).forEach((id) => deleteIds.add(id)));
    }
    const deletedLoopIds = new Set(selectedLoops.map((loop) => loop.id));
    const nextNodes = nodes.filter((node) => !deleteIds.has(node.id)).map((node) => {
        if (!node.parentNode || !deletedLoopIds.has(node.parentNode)) return node;
        const absolute = absolutePosition(node.id, graph);
        return { ...node, parentNode: undefined, position: absolute, positionAbsolute: undefined } as T;
    });
    const nextEdges = edges.filter((edge) => !deleteIds.has(edge.source) && !deleteIds.has(edge.target));
    return { nodes: nextNodes, edges: nextEdges };
}

function nodeDimension(value: number | null | undefined, styled: number | string | undefined, fallback: number): number {
    const parsed = value ?? (typeof styled === 'number' ? styled : Number.parseFloat(styled ?? ''));
    return Number.isFinite(parsed) ? parsed : fallback;
}
