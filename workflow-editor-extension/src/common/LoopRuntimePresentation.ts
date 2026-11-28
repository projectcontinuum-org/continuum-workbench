import type { INodeToOutputsMap } from '@continuum/core';
import { deepEqual, ownFlowVariables } from './FlowVariables';
import { descendants, GraphLike, isLoopNode, NodeLike } from './LoopTopology';
import { parseCondition } from './LoopConditionQuery';

export interface LoopRuntimeVariable {
    name: string;
    value: unknown;
}

export interface LoopRuntimeSummary {
    sourceLabel: string;
    variables: LoopRuntimeVariable[];
}

interface RuntimeNode extends NodeLike {
    data?: (NodeLike['data'] & {
        title?: string;
        properties?: { condition?: unknown };
    }) | null;
}

interface RuntimeGraph extends GraphLike {
    nodes: ReadonlyArray<RuntimeNode>;
}

/** Create a summary only when the run snapshot contains carried values and a member source. */
export function loopRuntimeSummary(
    loopId: string,
    graph: RuntimeGraph,
    nodeToOutputs: INodeToOutputsMap,
): LoopRuntimeSummary | undefined {
    const carriedData = nodeToOutputs[loopId]?.$variable?.data;
    if (!isRecord(carriedData)) return undefined;

    const variables = Object.entries(carriedData)
        .filter(([, value]) => value !== null && value !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, value]) => ({ name, value }));
    if (variables.length === 0) return undefined;

    const loop = graph.nodes.find((node) => node.id === loopId);
    const condition = typeof loop?.data?.properties?.condition === 'string'
        ? loop.data.properties.condition
        : '';
    const conditionVariable = parseCondition(condition)?.variable;
    const source = findSourceNode(loopId, graph, nodeToOutputs, variables, conditionVariable);
    if (!source) return undefined;

    return {
        sourceLabel: source.data?.title || source.id,
        variables,
    };
}

function findSourceNode(
    loopId: string,
    graph: RuntimeGraph,
    nodeToOutputs: INodeToOutputsMap,
    carriedVariables: LoopRuntimeVariable[],
    conditionVariable?: string,
): RuntimeNode | undefined {
    const memberIds = descendants(loopId, graph);
    const memberWriters = graph.nodes
        .filter((node) => memberIds.has(node.id) && !isLoopNode(node.type ?? ''))
        .map((node) => ({ node, variables: ownFlowVariables(nodeToOutputs[node.id]) }))
        .filter(({ variables }) => Object.keys(variables).length > 0);

    const writesCarriedValues = memberWriters.filter(({ variables }) =>
        carriedVariables.some(({ name, value }) =>
            Object.prototype.hasOwnProperty.call(variables, name) && deepEqual(variables[name], value)));
    const conditionWriters = conditionVariable
        ? writesCarriedValues.filter(({ variables }) => Object.prototype.hasOwnProperty.call(variables, conditionVariable))
        : [];
    return (conditionWriters.at(-1) ?? writesCarriedValues.at(-1))?.node;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
