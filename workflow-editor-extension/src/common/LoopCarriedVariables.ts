/**
 * Loop-carried flow variables — the workbench's view of what entry members inherited.
 *
 * A finished loop stores its carried variables as a display-only `$variable` output on the
 * loop node itself (in the run snapshot). Carried values apply at actual entry members; those
 * members' available values then flow to internal children through ordinary parent merging.
 */

import { enclosingLoops, isLoopNode, loopIds } from './LoopTopology';
import {
    FlowGraphLike,
    FlowVariables,
    FlowVariableRow,
    flowVariableRows,
    inheritedFlowVariables,
    InheritedFlowVariablesOverlay,
    NodeOutputsLike,
    NodeToOutputsLike,
    InheritedFlowVariables,
    ownFlowVariables,
} from './FlowVariables';

/** The reserved output key holding a finished loop's carried variables (display only). */
export const LOOP_CARRIED_KEY = '$variable';

export interface LoopCarriedFlowGraphLike extends Omit<FlowGraphLike, 'nodes'> {
    /** Extra: the outputs of each node, including the loop's `$variable`. */
    nodeToOutputs: NodeToOutputsLike;
    nodes: ReadonlyArray<{
        id: string;
        type?: string;
        parentNode?: string | null;
        data?: { inputs?: Record<string, unknown> | null; collapsed?: boolean | null } | null;
    }>;
}

export interface FlowVariableDisplay {
    rows: FlowVariableRow[];
    conflicts: InheritedFlowVariables['conflicts'];
}

/** Recompute inherited values, applying carried values at loop entry members before propagating them onward. */
export function inheritedVariablesForNode(nodeId: string, graph: LoopCarriedFlowGraphLike): InheritedFlowVariables {
    const carriedLoopIds = new Set(loopIds(graph));
    if (carriedLoopIds.size === 0) {
        return inheritedFlowVariables(nodeId, graph, graph.nodeToOutputs);
    }
    return inheritedFlowVariables(
        nodeId,
        graph,
        graph.nodeToOutputs,
        (targetId, inherited) => overlayCarriedValues(targetId, graph, inherited, carriedLoopIds),
    );
}

/** Build the same rows consumed by the Node Outputs Flow Variables tab. */
export function flowVariableDisplayForNode(
    nodeId: string,
    graph: LoopCarriedFlowGraphLike,
    nodeOutputs: NodeOutputsLike,
): FlowVariableDisplay {
    const inherited = inheritedVariablesForNode(nodeId, graph);
    return {
        rows: flowVariableRows(ownFlowVariables(nodeOutputs), inherited.variables),
        conflicts: inherited.conflicts,
    };
}

/**
 * Compute inherited values for a loop member while limiting carry overlays to the supplied loops.
 * Each overlay is applied only when the node is an entry member of that loop. This also lets
 * carried values on entry ancestors flow through their own outputs to internal children.
 */
export function inheritedVariablesForEntryMember(
    nodeId: string,
    graph: LoopCarriedFlowGraphLike,
    enclosingLoopIds: string[], // from outermost to innermost
): InheritedFlowVariables {
    const permittedLoopIds = new Set(enclosingLoopIds);
    const overlay: InheritedFlowVariablesOverlay = (targetId, inherited) =>
        overlayCarriedValues(targetId, graph, inherited, permittedLoopIds);
    return inheritedFlowVariables(nodeId, graph, graph.nodeToOutputs, overlay);
}

function overlayCarriedValues(
    nodeId: string,
    graph: LoopCarriedFlowGraphLike,
    inherited: FlowVariables,
    permittedLoopIds: ReadonlySet<string>,
): FlowVariables {
    const node = graph.nodes.find((candidate) => candidate.id === nodeId);
    if (!node || isLoopNode(node.type ?? '')) {
        return inherited;
    }

    const entryScopes = enclosingLoops(nodeId, graph).filter(({ loopId, members }) =>
        permittedLoopIds.has(loopId) && !hasIncomingEdgeFromLoopMember(nodeId, members, graph));
    return entryScopes.reduce((variables, { loopId }) => ({
        ...variables,
        ...carriedVariables(loopId, graph.nodeToOutputs[loopId]),
    }), inherited);
}

function hasIncomingEdgeFromLoopMember(
    nodeId: string,
    members: ReadonlySet<string>,
    graph: LoopCarriedFlowGraphLike,
): boolean {
    return graph.edges.some((edge) =>
        edge.target === nodeId && members.has(edge.source) && members.has(edge.target));
}

function carriedVariables(loopId: string, nodeOutputs: NodeOutputsLike | undefined): FlowVariables {
    const data = nodeOutputs?.[LOOP_CARRIED_KEY]?.data;
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        return {};
    }
    return Object.fromEntries(
        Object.entries(data as Record<string, unknown>).filter(([, value]) => value !== null && value !== undefined),
    );
}
