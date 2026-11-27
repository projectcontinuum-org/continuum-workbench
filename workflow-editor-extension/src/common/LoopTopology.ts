/**
 * Pure loop topology helpers for membership, collapsed rendering, and cycle checks.
 */

export const LOOP_NODE_MODEL = 'org.projectcontinuum.core.builtin.Loop';

export interface Point {
    x: number;
    y: number;
}

export interface LoopScope {
    readonly loopId: string;
    readonly members: ReadonlySet<string>;
}

export interface GraphLike {
    nodes: ReadonlyArray<NodeLike>;
    edges: ReadonlyArray<EdgeLike>;
}

export interface NodeLike {
    id: string;
    type?: string;
    parentNode?: string | null;
    position?: Point;
    positionAbsolute?: Point;
    width?: number | null;
    height?: number | null;
    style?: { width?: number | string; height?: number | string };
    hidden?: boolean;
    data?: { collapsed?: boolean | null } | null;
}

export interface EdgeLike {
    id?: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    className?: string;
}

export type CollapsedLoopEdgeSide = 'left' | 'right';

/** React Flow handle ids used only by the derived collapsed-loop display edges. */
export function collapsedLoopHandleId(
    direction: 'source' | 'target',
    side: CollapsedLoopEdgeSide,
): string {
    return `loop-${direction}-${side}`;
}

/** Mark derived display edges touching loop members without changing their saved connections. */
export function withLoopScopedEdgeClass<E extends EdgeLike>(
    nodes: ReadonlyArray<NodeLike>,
    edges: ReadonlyArray<E>,
): E[] {
    const graph = { nodes, edges };
    const loopMembers = new Set(nodes
        .filter((node) => enclosingLoops(node.id, graph).length > 0)
        .map((node) => node.id));
    return edges.map((edge) => {
        if (!loopMembers.has(edge.source) && !loopMembers.has(edge.target)) return edge as E;
        const classes = new Set((edge.className ?? '').split(/\s+/).filter(Boolean));
        if (classes.has('loop-scoped-edge')) return edge as E;
        classes.add('loop-scoped-edge');
        return { ...edge, className: [...classes].join(' ') } as E;
    });
}

/** Returns true if the React Flow node type represents a Loop box. */
export function isLoopNode(nodeType: string): boolean {
    return nodeType === 'Loop';
}

/** All loop ids in graph declaration order. */
export function loopIds(graph: GraphLike): string[] {
    return graph.nodes.filter((node) => isLoopNode(node.type ?? '')).map((node) => node.id);
}

/** The direct children of a loop, as represented by React Flow's top-level parentNode field. */
export function directMembers(loopId: string, graph: GraphLike): ReadonlySet<string> {
    return new Set(graph.nodes.filter((node) => node.parentNode === loopId).map((node) => node.id));
}

/** All nested members, including directly nested Loop boxes, but never unrelated loops. */
export function descendants(loopId: string, graph: GraphLike): ReadonlySet<string> {
    return collectDescendants(loopId, graph, new Set());
}

function collectDescendants(loopId: string, graph: GraphLike, visiting: Set<string>): Set<string> {
    if (visiting.has(loopId)) {
        return new Set();
    }
    const nextVisiting = new Set(visiting).add(loopId);
    const members = new Set(directMembers(loopId, graph));
    for (const child of graph.nodes) {
        if (child.parentNode === loopId && isLoopNode(child.type ?? '')) {
            collectDescendants(child.id, graph, nextVisiting).forEach((id) => members.add(id));
        }
    }
    return members;
}

/** The containing loops from outermost to innermost. */
export function enclosingLoops(nodeId: string, graph: GraphLike): LoopScope[] {
    const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
    const scopes: LoopScope[] = [];
    const visited = new Set<string>();
    let node = nodesById.get(nodeId);

    while (node?.parentNode && !visited.has(node.parentNode)) {
        visited.add(node.parentNode);
        const parent = nodesById.get(node.parentNode);
        if (!parent) {
            break;
        }
        if (isLoopNode(parent.type ?? '')) {
            scopes.push({ loopId: parent.id, members: descendants(parent.id, graph) });
        }
        node = parent;
    }
    return scopes.reverse();
}

/** The innermost loop containing a node, or undefined for a top-level node. */
export function innermostLoopOf(nodeId: string, graph: GraphLike): LoopScope | undefined {
    const loops = enclosingLoops(nodeId, graph);
    return loops[loops.length - 1];
}

/**
 * Reject plain graph cycles and cycles formed when each loop's member scope is collapsed to its box.
 * Connections whose endpoint is a loop box are invalid independently of cycle detection.
 */
export function wouldCreateCycle(sourceId: string, targetId: string, graph: GraphLike): boolean {
    if (sourceId === targetId || isLoopNodeType(sourceId, graph) || isLoopNodeType(targetId, graph)) {
        return true;
    }
    const proposedEdges = [...graph.edges, { source: sourceId, target: targetId }];
    return hasCycleInGraph({ nodes: graph.nodes, edges: proposedEdges });
}

/** Whether the graph already has a plain or collapsed-scope cycle. */
export function hasCycleInGraph(graph: GraphLike): boolean {
    if (containsCycle(graph.nodes.map((node) => node.id), graph.edges, (id) => id)) {
        return true;
    }
    for (const loopId of loopIds(graph)) {
        const scope = descendants(loopId, graph);
        const collapse = (id: string): string => id === loopId || scope.has(id) ? loopId : id;
        if (containsCycle(
            graph.nodes.map((node) => collapse(node.id)),
            graph.edges,
            collapse,
        )) {
            return true;
        }
    }
    return false;
}

function isLoopNodeType(nodeId: string, graph: GraphLike): boolean {
    return graph.nodes.some((node) => node.id === nodeId && isLoopNode(node.type ?? ''));
}

function containsCycle(nodeIds: string[], edges: ReadonlyArray<EdgeLike>, mapNode: (id: string) => string): boolean {
    const adjacency = new Map<string, string[]>();
    nodeIds.forEach((id) => adjacency.set(mapNode(id), []));
    for (const edge of edges) {
        const source = mapNode(edge.source);
        const target = mapNode(edge.target);
        if (source !== target) {
            const outgoing = adjacency.get(source) ?? [];
            outgoing.push(target);
            adjacency.set(source, outgoing);
            if (!adjacency.has(target)) {
                adjacency.set(target, []);
            }
        }
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (nodeId: string): boolean => {
        if (visiting.has(nodeId)) {
            return true;
        }
        if (visited.has(nodeId)) {
            return false;
        }
        visiting.add(nodeId);
        for (const target of adjacency.get(nodeId) ?? []) {
            if (visit(target)) {
                return true;
            }
        }
        visiting.delete(nodeId);
        visited.add(nodeId);
        return false;
    };
    return [...adjacency.keys()].some(visit);
}

/** Find the innermost expanded loop containing a point, ignoring nodes in excluded subtrees. */
export function findDropTarget(point: Point, graph: GraphLike, excludedIds: ReadonlySet<string> = new Set()): string | undefined {
    const candidates = graph.nodes
        .filter((node) => isLoopNode(node.type ?? '') && !node.data?.collapsed && !excludedIds.has(node.id))
        .map((node) => ({ node, position: absolutePositionFromParentChain(node.id, graph) }))
        .filter(({ node, position }) => {
            const width = dimension(node.width, node.style?.width, 520);
            const height = dimension(node.height, node.style?.height, 320);
            return point.x >= position.x && point.x <= position.x + width
                && point.y >= position.y && point.y <= position.y + height;
        })
        .sort((left, right) => {
            const leftArea = dimension(left.node.width, left.node.style?.width, 520) * dimension(left.node.height, left.node.style?.height, 320);
            const rightArea = dimension(right.node.width, right.node.style?.width, 520) * dimension(right.node.height, right.node.style?.height, 320);
            return leftArea - rightArea;
        });
    return candidates[0]?.node.id;
}

/** Compute a node's canvas position from its parent-relative position. */
export function absolutePosition(nodeId: string, graph: GraphLike): Point {
    return absolutePositionWithinGraph(nodeId, graph, new Set());
}

/**
 * Compute a node's canvas position from its parent-relative positions, ignoring React Flow's cached
 * positionAbsolute values. Drag-stop events can carry a cached absolute position from before the
 * final pointer movement, while position remains relative to the current parent.
 */
export function absolutePositionFromParentChain(nodeId: string, graph: GraphLike): Point {
    const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
    return absolutePositionFromParentChainWithinGraph(nodeId, nodesById, new Set());
}

function absolutePositionFromParentChainWithinGraph(
    nodeId: string,
    nodesById: ReadonlyMap<string, NodeLike>,
    visited: Set<string>,
): Point {
    const node = nodesById.get(nodeId);
    if (!node || visited.has(nodeId)) {
        return { x: 0, y: 0 };
    }

    const position = node.position ?? { x: 0, y: 0 };
    if (!node.parentNode) {
        return position;
    }

    const parentPosition = absolutePositionFromParentChainWithinGraph(
        node.parentNode,
        nodesById,
        new Set(visited).add(nodeId),
    );
    return { x: parentPosition.x + position.x, y: parentPosition.y + position.y };
}

function absolutePositionWithinGraph(nodeId: string, graph: GraphLike, visited: Set<string>): Point {
    const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
    const node = nodesById.get(nodeId);
    if (!node || visited.has(nodeId)) {
        return { x: 0, y: 0 };
    }
    if (node.positionAbsolute) {
        return node.positionAbsolute;
    }
    const position = node.position ?? { x: 0, y: 0 };
    if (!node.parentNode) {
        return position;
    }
    const parentPosition = absolutePositionWithinGraph(node.parentNode, graph, new Set(visited).add(nodeId));
    return { x: parentPosition.x + position.x, y: parentPosition.y + position.y };
}

/** Convert a canvas position to a position relative to its new parent. */
export function toRelativePosition(position: Point, parentId: string | undefined, graph: GraphLike): Point {
    if (!parentId) {
        return position;
    }
    const parentPosition = absolutePosition(parentId, graph);
    return { x: position.x - parentPosition.x, y: position.y - parentPosition.y };
}

/** Convert a canvas position to a parent-relative position without using cached absolute coordinates. */
export function toRelativePositionFromParentChain(
    position: Point,
    parentId: string | undefined,
    graph: GraphLike,
): Point {
    if (!parentId) {
        return position;
    }
    const parentPosition = absolutePositionFromParentChain(parentId, graph);
    return { x: position.x - parentPosition.x, y: position.y - parentPosition.y };
}

/** Return nodes in stable parent-before-child order, preserving sibling order. */
export function orderParentFirst<T extends NodeLike>(nodes: ReadonlyArray<T>): T[] {
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const childrenByParent = new Map<string, T[]>();
    for (const node of nodes) {
        if (node.parentNode && nodesById.has(node.parentNode)) {
            const children = childrenByParent.get(node.parentNode) ?? [];
            children.push(node);
            childrenByParent.set(node.parentNode, children);
        }
    }
    const ordered: T[] = [];
    const visited = new Set<string>();
    const append = (node: T): void => {
        if (visited.has(node.id)) {
            return;
        }
        visited.add(node.id);
        ordered.push(node);
        (childrenByParent.get(node.id) ?? []).forEach(append);
    };
    nodes.filter((node) => !node.parentNode || !nodesById.has(node.parentNode)).forEach(append);
    nodes.forEach(append);
    return ordered;
}

/** Derive hidden member ids and display-only edges for collapsed loops; stored edges are never changed. */
export function collapsedView<T extends NodeLike, E extends EdgeLike>(
    nodes: ReadonlyArray<T>,
    edges: ReadonlyArray<E>,
): { hiddenNodeIds: ReadonlySet<string>; displayEdges: E[] } {
    const graph: GraphLike = { nodes, edges };
    const collapsedLoops = loopIds(graph).filter((loopId) => nodes.find((node) => node.id === loopId)?.data?.collapsed);
    const collapsedAncestor = (nodeId: string): string | undefined => {
        return enclosingLoops(nodeId, graph).find((scope) => collapsedLoops.includes(scope.loopId))?.loopId;
    };
    const hiddenNodeIds = new Set<string>();
    nodes.forEach((node) => {
        if (collapsedAncestor(node.id)) {
            hiddenNodeIds.add(node.id);
        }
    });
    const displayEdges: E[] = [];
    for (const edge of edges) {
        const sourceLoop = collapsedAncestor(edge.source);
        const targetLoop = collapsedAncestor(edge.target);
        if (sourceLoop && sourceLoop === targetLoop) {
            continue;
        }
        displayEdges.push({
            ...edge,
            source: sourceLoop ?? edge.source,
            target: targetLoop ?? edge.target,
            sourceHandle: sourceLoop
                ? collapsedLoopHandleId('source', collapsedLoopSide(sourceLoop, edge.target, graph))
                : edge.sourceHandle,
            targetHandle: targetLoop
                ? collapsedLoopHandleId('target', collapsedLoopSide(targetLoop, edge.source, graph))
                : edge.targetHandle,
        });
    }
    return { hiddenNodeIds, displayEdges };
}

function collapsedLoopSide(loopId: string, otherNodeId: string, graph: GraphLike): CollapsedLoopEdgeSide {
    const loop = graph.nodes.find((node) => node.id === loopId);
    if (!loop) return 'left';
    const loopPosition = absolutePosition(loopId, graph);
    const otherPosition = absolutePosition(otherNodeId, graph);
    const loopCenterX = loopPosition.x + dimension(loop.width, loop.style?.width, 520) / 2;
    const otherNode = graph.nodes.find((node) => node.id === otherNodeId);
    const otherCenterX = otherPosition.x + dimension(otherNode?.width, otherNode?.style?.width, 170) / 2;
    return otherCenterX < loopCenterX ? 'left' : 'right';
}

function dimension(value: number | null | undefined, styleValue: number | string | undefined, fallback: number): number {
    const resolved = value ?? (typeof styleValue === 'number' ? styleValue : Number.parseFloat(styleValue ?? ''));
    return Number.isFinite(resolved) ? resolved : fallback;
}
