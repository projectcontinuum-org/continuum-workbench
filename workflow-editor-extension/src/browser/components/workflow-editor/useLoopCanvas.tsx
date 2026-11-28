import React from 'react';
import {
    applyNodeChanges,
    Connection,
    Edge,
    Node,
    NodeChange,
} from 'reactflow';
import {
    collapsedView,
    GraphLike,
    withLoopScopedEdgeClass,
    wouldCreateCycle,
} from '../../../common/LoopTopology';
import { LOOP_COLLAPSED_HEIGHT, loopCollapsedWidth } from '../../../common/LoopPresentation';
import {
    deleteSelectedGraph,
    LoopDeleteChoice,
    loopMinimumSize,
    loopStoredSize,
    moveDraggedNode,
    persistLoopResize,
} from '../../../common/LoopCanvasOperations';
import { BaseCanvasNodeRenderer, LoopCanvasNodeContextValue, LoopCanvasNodeRenderer } from './LoopCanvasNode';

interface UseLoopCanvasOptions<T extends Node, E extends Edge> {
    nodes: T[];
    edges: E[];
    setNodes: React.Dispatch<React.SetStateAction<T[]>>;
    setEdges: React.Dispatch<React.SetStateAction<E[]>>;
    isActive: boolean;
    onHistoryChange?: () => void;
    onTopologyError?: (message: string) => void;
    onConfirmLoopDelete?: (loopCount: number) => Promise<LoopDeleteChoice | undefined>;
    onOpenSettings?: (nodeId: string) => void;
}

interface NodeRenderingOptions<T extends Node, E extends Edge> {
    nodes: T[];
    edges: E[];
    setNodes: React.Dispatch<React.SetStateAction<T[]>>;
    onHistoryChange?: () => void;
    onOpenSettings?: (nodeId: string) => void;
}

interface TopologyHandlerOptions<T extends Node, E extends Edge> {
    nodes: T[];
    edges: E[];
    setNodes: React.Dispatch<React.SetStateAction<T[]>>;
    onHistoryChange?: () => void;
    onTopologyError?: (message: string) => void;
}

export function useLoopCanvas<T extends Node, E extends Edge>(options: UseLoopCanvasOptions<T, E>) {
    const rendering = useLoopNodeRendering(options);
    const topology = useLoopTopologyHandlers(options);
    const deletion = useLoopDeletion(options);
    return { ...rendering, ...topology, ...deletion };
}

function useLoopNodeRendering<T extends Node, E extends Edge>({
    nodes,
    edges,
    setNodes,
    onHistoryChange,
    onOpenSettings,
}: NodeRenderingOptions<T, E>) {
    const toggleLoopCollapsed = React.useCallback((loopId: string) => {
        setNodes((current) => current.map((node) => node.id === loopId
            ? { ...node, data: { ...node.data, collapsed: !node.data?.collapsed } }
            : node));
        window.setTimeout(() => onHistoryChange?.(), 0);
    }, [onHistoryChange, setNodes]);
    const resizeLoop = React.useCallback((loopId: string, width: number, height: number) => {
        setNodes((current) => persistLoopResize(current, loopId, { width, height }));
    }, [setNodes]);
    const finishLoopResize = React.useCallback(() => {
        window.setTimeout(() => onHistoryChange?.(), 0);
    }, [onHistoryChange]);
    const graph = React.useMemo((): GraphLike => ({ nodes, edges }), [nodes, edges]);
    const nodeTypes = React.useMemo(() => ({
        BaseNode: BaseCanvasNodeRenderer,
        Loop: LoopCanvasNodeRenderer,
    }), []);
    const nodeContext = React.useMemo<LoopCanvasNodeContextValue>(() => ({
        graph,
        toggleCollapsed: toggleLoopCollapsed,
        resize: resizeLoop,
        finishResize: finishLoopResize,
        openSettings: onOpenSettings,
    }), [finishLoopResize, graph, onOpenSettings, resizeLoop, toggleLoopCollapsed]);
    const scopedEdges = React.useMemo(() => withLoopScopedEdgeClass(nodes, edges), [nodes, edges]);
    const collapsed = React.useMemo(() => collapsedView(nodes, scopedEdges), [nodes, scopedEdges]);
    const displayNodes = React.useMemo(() => makeDisplayNodes(nodes, graph, collapsed.hiddenNodeIds), [
        collapsed.hiddenNodeIds, graph, nodes,
    ]);
    return { displayNodes, displayEdges: collapsed.displayEdges, nodeTypes, nodeContext };
}

function makeDisplayNodes(
    nodes: Node[],
    graph: GraphLike,
    hiddenNodeIds: ReadonlySet<string>,
): Node[] {
    return nodes.map((node) => {
        if (node.type !== 'Loop') return { ...node, hidden: hiddenNodeIds.has(node.id) || node.hidden };
        const minimum = loopMinimumSize(node.id, graph);
        const expandedSize = loopStoredSize(node.id, graph);
        const isCollapsed = !!node.data?.collapsed;
        const width = isCollapsed ? loopCollapsedWidth(expandedSize.width) : expandedSize.width;
        return {
            ...node,
            className: `${node.className ?? ''} loop-node-wrapper`.trim(),
            width,
            height: isCollapsed ? LOOP_COLLAPSED_HEIGHT : expandedSize.height,
            zIndex: -1,
            style: {
                ...node.style,
                width,
                height: isCollapsed ? LOOP_COLLAPSED_HEIGHT : expandedSize.height,
            },
            hidden: hiddenNodeIds.has(node.id) || node.hidden,
            data: { ...node.data, resizeMinWidth: minimum.width, resizeMinHeight: minimum.height },
        };
    });
}

function useLoopTopologyHandlers<T extends Node, E extends Edge>({
    nodes,
    edges,
    setNodes,
    onHistoryChange,
    onTopologyError,
}: TopologyHandlerOptions<T, E>) {
    const dragStartNodes = React.useRef<T[]>([]);
    const graph = React.useMemo((): GraphLike => ({ nodes, edges }), [nodes, edges]);
    const onNodeDragStart = React.useCallback((_event: React.MouseEvent, draggedNode: Node) => {
        dragStartNodes.current = nodes.map((node) => ({ ...node }));
    }, [nodes]);
    const onNodeDragStop = React.useCallback((_event: React.MouseEvent, draggedNode: Node) => {
        const result = moveDraggedNode<T, E>(nodes, edges, draggedNode as T, dragStartNodes.current);
        if (result.refused) onTopologyError?.('This drop would create a cycle across a loop boundary.');
        setNodes(result.nodes);
        dragStartNodes.current = [];
        onHistoryChange?.();
    }, [edges, nodes, onHistoryChange, onTopologyError, setNodes]);
    const onNodesChange = React.useCallback((changes: NodeChange[]) => {
        const collapsedLoops = new Set(nodes
            .filter((node) => node.type === 'Loop' && node.data?.collapsed)
            .map((node) => node.id));
        const visibleChanges = changes.filter((change) =>
            change.type !== 'dimensions' || !collapsedLoops.has(change.id));
        setNodes((current) => applyNodeChanges(visibleChanges, current) as T[]);
    }, [nodes, setNodes]);
    const isValidConnection = React.useCallback((connection: Connection): boolean => {
        if (!connection.source || !connection.target
            || wouldCreateCycle(connection.source, connection.target, graph)) return false;
        return !edges.some((edge) => edge.target === connection.target
            && edge.targetHandle === connection.targetHandle);
    }, [edges, graph]);
    return { onNodeDragStart, onNodeDragStop, onNodesChange, isValidConnection };
}

function useLoopDeletion<T extends Node, E extends Edge>({
    nodes,
    edges,
    setNodes,
    setEdges,
    isActive,
    onHistoryChange,
    onConfirmLoopDelete,
}: UseLoopCanvasOptions<T, E>) {
    const deleteSelectedNodes = React.useCallback(async (selectedIds?: ReadonlySet<string>) => {
        if (isActive) return;
        const ids = selectedIds ?? new Set(nodes.filter((node) => node.selected).map((node) => node.id));
        if (ids.size === 0) return;
        const loopCount = nodes.filter((node) => ids.has(node.id) && node.type === 'Loop').length;
        const choice = loopCount ? await onConfirmLoopDelete?.(loopCount) : 'delete-members';
        if (loopCount && !choice) return;
        const result = deleteSelectedGraph<T, E>(nodes, edges, ids, choice ?? 'delete-members');
        setNodes(result.nodes);
        setEdges(result.edges);
        window.setTimeout(() => onHistoryChange?.(), 0);
    }, [edges, isActive, nodes, onConfirmLoopDelete, onHistoryChange, setEdges, setNodes]);
    return { deleteSelectedNodes };
}
