/**
 * Flow variables of a finished run, as shown in the Node Outputs dialog.
 *
 * The platform stores a node's flow variables under the reserved `$variable` key of its outputs. That entry holds only
 * the variables the node set itself; the variables it inherited are sent to the worker but never stored. They are
 * recomputed here from the run snapshot with the orchestrator's rules.
 *
 * KEEP IN STEP with `FlowVariableMerger` (continuum-platform-core, continuum-orchestration-service):
 * - available(P) = inherited(P) overridden by P's own variables;
 * - inherited(N) = fan-in merge of available(parent) over N's incoming edges, ordered by the index of the target port
 *   in the node's declared inputs, then targetHandle, then source id; the first value per name wins; a different
 *   later value is a conflict, reported only at N.
 *
 * Structural types only (no reactflow / @continuum/core imports), so the node:test specs compile on their own.
 */

/** Reserved output key holding the variables a node set itself. Mirrors `NodeOutputSystemPort.VARIABLE`. */
export const FLOW_VARIABLES_KEY = '$variable';

/** Reserved output key of a failed node. Mirrors `NodeOutputSystemPort.ERROR`. */
export const ERROR_KEY = '$error';

/** Every key starting with `$` is a system key, not a data port. */
export function isSystemKey(key: string): boolean {
    return key.startsWith('$');
}

export type FlowVariables = Record<string, unknown>;

/** The part of a node's outputs map this module reads. */
export type NodeOutputsLike = Record<string, { data?: unknown } | undefined>;

export type NodeToOutputsLike = Record<string, NodeOutputsLike | undefined>;

/** The part of the run snapshot this module reads. */
export interface FlowGraphLike {
    nodes: ReadonlyArray<{ id: string; data?: { inputs?: Record<string, unknown> | null } | null }>;
    edges: ReadonlyArray<{ source: string; target: string; targetHandle?: string | null }>;
}

export interface FlowVariableConflict {
    name: string;
    keptFromNodeId: string;
    ignoredFromNodeId: string;
}

export interface InheritedFlowVariables {
    variables: FlowVariables;
    /** Conflicts found where this node's own parents meet. */
    conflicts: FlowVariableConflict[];
}

export type FlowVariableOrigin = 'set' | 'inherited' | 'overridden';

export interface FlowVariableRow {
    name: string;
    value: unknown;
    origin: FlowVariableOrigin;
    /** For `overridden`: the inherited value the node replaced. */
    inheritedValue?: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The variables a node set itself (`outputs["$variable"].data`), or `{}` when absent or not a JSON object. */
export function ownFlowVariables(outputs: NodeOutputsLike | null | undefined): FlowVariables {
    const data = outputs?.[FLOW_VARIABLES_KEY]?.data;
    if (!isPlainObject(data)) {
        return {};
    }
    const variables: FlowVariables = {};
    for (const [name, value] of Object.entries(data)) {
        if (value !== null && value !== undefined) {
            variables[name] = value;
        }
    }
    return variables;
}

/** The output keys to list as ports: data ports plus `$error` (first, so a failed node opens on its error). */
export function dataPortIds(outputs: NodeOutputsLike | null | undefined): string[] {
    const keys = Object.keys(outputs ?? {});
    const dataPorts = keys.filter((key) => !isSystemKey(key));
    return keys.includes(ERROR_KEY) ? [ERROR_KEY, ...dataPorts] : dataPorts;
}

/** Structural equality of decoded JSON values (key order of objects does not matter). */
export function deepEqual(left: unknown, right: unknown): boolean {
    if (left === right) {
        return true;
    }
    if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
            return false;
        }
        return left.every((item, index) => deepEqual(item, right[index]));
    }
    if (isPlainObject(left) && isPlainObject(right)) {
        const leftKeys = Object.keys(left);
        const rightKeys = Object.keys(right);
        if (leftKeys.length !== rightKeys.length) {
            return false;
        }
        return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && deepEqual(left[key], right[key]));
    }
    return false;
}

function compareStrings(left: string, right: string): number {
    if (left < right) {
        return -1;
    }
    return left > right ? 1 : 0;
}

/** The flow variables [nodeId] inherited from all of its ancestors, recomputed from the run snapshot. */
export function inheritedFlowVariables(
    nodeId: string,
    graph: FlowGraphLike,
    nodeToOutputsMap: NodeToOutputsLike
): InheritedFlowVariables {
    const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
    const parentEdgesByTarget = new Map<string, FlowGraphLike['edges'][number][]>();
    for (const edge of graph.edges) {
        const parentEdges = parentEdgesByTarget.get(edge.target) ?? [];
        parentEdges.push(edge);
        parentEdgesByTarget.set(edge.target, parentEdges);
    }
    const availableByNodeId = new Map<string, FlowVariables>();
    const visiting = new Set<string>();

    const mergeParents = (targetId: string): InheritedFlowVariables => {
        const declaredInputs = Object.keys(nodesById.get(targetId)?.data?.inputs ?? {});
        const portIndex = (handle: string): number => {
            const index = declaredInputs.indexOf(handle);
            return index < 0 ? Number.MAX_SAFE_INTEGER : index;
        };
        const orderedParentIds = [...(parentEdgesByTarget.get(targetId) ?? [])]
            .sort((left, right) => {
                const leftHandle = left.targetHandle ?? '';
                const rightHandle = right.targetHandle ?? '';
                return portIndex(leftHandle) - portIndex(rightHandle)
                    || compareStrings(leftHandle, rightHandle)
                    || compareStrings(left.source, right.source);
            })
            .map((edge) => edge.source)
            .filter((source, index, all) => all.indexOf(source) === index);

        const merged = new Map<string, { value: unknown; fromNodeId: string }>();
        const conflicts: FlowVariableConflict[] = [];
        for (const parentId of orderedParentIds) {
            for (const [name, value] of Object.entries(available(parentId))) {
                const existing = merged.get(name);
                if (!existing) {
                    merged.set(name, { value, fromNodeId: parentId });
                } else if (!deepEqual(existing.value, value)) {
                    conflicts.push({ name, keptFromNodeId: existing.fromNodeId, ignoredFromNodeId: parentId });
                }
            }
        }
        const variables: FlowVariables = {};
        merged.forEach((sourced, name) => {
            variables[name] = sourced.value;
        });
        return { variables, conflicts };
    };

    const available = (ancestorId: string): FlowVariables => {
        const cached = availableByNodeId.get(ancestorId);
        if (cached) {
            return cached;
        }
        if (visiting.has(ancestorId)) {
            // A cycle cannot be run by the platform; stop instead of recursing forever.
            return {};
        }
        visiting.add(ancestorId);
        const result = { ...mergeParents(ancestorId).variables, ...ownFlowVariables(nodeToOutputsMap[ancestorId]) };
        visiting.delete(ancestorId);
        availableByNodeId.set(ancestorId, result);
        return result;
    };

    visiting.add(nodeId);
    return mergeParents(nodeId);
}

/** One row per variable name, sorted by name: what the node set, inherited, or set over an inherited value. */
export function flowVariableRows(own: FlowVariables, inherited: FlowVariables): FlowVariableRow[] {
    const names = Array.from(new Set([...Object.keys(inherited), ...Object.keys(own)])).sort(compareStrings);
    return names.map((name): FlowVariableRow => {
        const isOwn = Object.prototype.hasOwnProperty.call(own, name);
        const isInherited = Object.prototype.hasOwnProperty.call(inherited, name);
        if (isOwn && isInherited) {
            return { name, value: own[name], origin: 'overridden', inheritedValue: inherited[name] };
        }
        if (isOwn) {
            return { name, value: own[name], origin: 'set' };
        }
        return { name, value: inherited[name], origin: 'inherited' };
    });
}
