export interface PortInfo {
    name?: string;
    contentType?: string;
}

export interface CatalogNode {
    id: string;
    title: string;
    description: string;
    nodeModel: string;
    inputs?: { [port: string]: PortInfo };
    outputs?: { [port: string]: PortInfo };
    properties?: { [key: string]: any };
    propertiesSchema?: any;
    [key: string]: any;
}

export type NodeCatalog = { [nodeId: string]: CatalogNode };

export interface SpecNode {
    key: string;
    nodeId: string;
    properties?: { [key: string]: any };
}

export interface SpecEdge {
    from: string;
    fromPort: string;
    to: string;
    toPort: string;
}

export interface WorkflowSpec {
    name: string;
    nodes: SpecNode[];
    edges: SpecEdge[];
}

export interface AssembledWorkflow {
    id: string;
    name: string;
    active: boolean;
    nodes: any[];
    edges: any[];
}

export type AssembleResult =
    | { ok: true; workflow: AssembledWorkflow; warnings: string[] }
    | { ok: false; errors: string[] };

const NODE_WIDTH = 224;
const NODE_HEIGHT = 100;
const X_STEP = 330;
const Y_STEP = 160;

function jsonType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

function matchesType(value: any, declared: string): boolean {
    const actual = jsonType(value);
    switch (declared) {
        case 'integer': return actual === 'number' && Number.isInteger(value);
        case 'number': return actual === 'number';
        case 'string':
        case 'boolean':
        case 'array':
        case 'object':
        case 'null':
            return actual === declared;
        default:
            return true;
    }
}

function validateProperty(nodeKey: string, prop: string, value: any, schema: any): string | undefined {
    if (!schema || typeof schema !== 'object') return undefined;
    const label = `Node '${nodeKey}' property '${prop}'`;
    if (schema.type !== undefined) {
        const types: string[] = Array.isArray(schema.type) ? schema.type : [schema.type];
        if (!types.some(t => matchesType(value, t))) {
            return `${label} must be of type ${types.join(' or ')}, got ${jsonType(value)}.`;
        }
    }
    if (Array.isArray(schema.enum) && !schema.enum.some((e: any) => JSON.stringify(e) === JSON.stringify(value))) {
        return `${label} must be one of ${JSON.stringify(schema.enum)}, got ${JSON.stringify(value)}.`;
    }
    if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0 && schema.oneOf.every((o: any) => o && 'const' in o)
        && !schema.oneOf.some((o: any) => JSON.stringify(o.const) === JSON.stringify(value))) {
        return `${label} must be one of ${JSON.stringify(schema.oneOf.map((o: any) => o.const))}, got ${JSON.stringify(value)}.`;
    }
    return undefined;
}

function randomHex64(): string {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function isMissing(value: any): boolean {
    return value === undefined || value === null || value === '';
}

export function validateSpec(spec: WorkflowSpec, catalog: NodeCatalog): string[] {
    const errors: string[] = [];

    if (!spec || typeof spec !== 'object') return ['The workflow spec must be an object.'];
    if (typeof spec.name !== 'string' || !spec.name.trim()) errors.push('The workflow needs a non-empty name.');
    if (!Array.isArray(spec.nodes) || spec.nodes.length === 0) {
        errors.push('The workflow needs at least one node.');
        return errors;
    }
    const edges = Array.isArray(spec.edges) ? spec.edges : [];

    const byKey = new Map<string, SpecNode>();
    for (const node of spec.nodes) {
        if (!node || typeof node.key !== 'string' || !node.key) {
            errors.push('Every node needs a non-empty string key.');
            continue;
        }
        if (byKey.has(node.key)) {
            errors.push(`Node key '${node.key}' is used more than once.`);
            continue;
        }
        byKey.set(node.key, node);

        const entry = catalog[node.nodeId];
        if (!entry) {
            errors.push(`Node '${node.key}': unknown nodeId '${node.nodeId}'. Use the exact node id returned by getContinuumNodeMetadata.`);
            continue;
        }

        const schemaProps: { [key: string]: any } = entry.propertiesSchema?.properties ?? {};
        const given = node.properties ?? {};
        if (jsonType(given) !== 'object') {
            errors.push(`Node '${node.key}': properties must be an object.`);
            continue;
        }
        for (const [prop, value] of Object.entries(given)) {
            if (!(prop in schemaProps)) {
                errors.push(`Node '${node.key}': unknown property '${prop}'. Known properties: ${Object.keys(schemaProps).join(', ') || '(none)'}.`);
                continue;
            }
            const problem = validateProperty(node.key, prop, value, schemaProps[prop]);
            if (problem) errors.push(problem);
        }
        const merged = { ...(entry.properties ?? {}), ...given };
        const required: string[] = Array.isArray(entry.propertiesSchema?.required) ? entry.propertiesSchema.required : [];
        for (const prop of required) {
            if (isMissing(merged[prop])) {
                errors.push(`Node '${node.key}': required property '${prop}' has no value. Set it in properties.`);
            }
        }
    }

    const seenEdges = new Set<string>();
    for (const edge of edges) {
        const label = `Edge ${edge?.from}.${edge?.fromPort} -> ${edge?.to}.${edge?.toPort}`;
        const src = byKey.get(edge?.from);
        const dst = byKey.get(edge?.to);
        if (!src) { errors.push(`${label}: source node key '${edge?.from}' does not exist.`); continue; }
        if (!dst) { errors.push(`${label}: target node key '${edge?.to}' does not exist.`); continue; }
        const srcEntry = catalog[src.nodeId];
        const dstEntry = catalog[dst.nodeId];
        if (srcEntry && !(edge.fromPort in (srcEntry.outputs ?? {}))) {
            errors.push(`${label}: '${src.nodeId}' has no output port '${edge.fromPort}'. Output ports: ${Object.keys(srcEntry.outputs ?? {}).join(', ') || '(none)'}.`);
        }
        if (dstEntry && !(edge.toPort in (dstEntry.inputs ?? {}))) {
            errors.push(`${label}: '${dst.nodeId}' has no input port '${edge.toPort}'. Input ports: ${Object.keys(dstEntry.inputs ?? {}).join(', ') || '(none)'}.`);
        }
        if (edge.from === edge.to) errors.push(`${label}: a node cannot connect to itself.`);
        const id = `${edge.from}|${edge.fromPort}|${edge.to}|${edge.toPort}`;
        if (seenEdges.has(id)) errors.push(`${label}: duplicate edge.`);
        seenEdges.add(id);
    }

    const toPortUse = new Set<string>();
    for (const edge of edges) {
        const key = `${edge?.to}|${edge?.toPort}`;
        if (toPortUse.has(key)) errors.push(`Input port '${edge.toPort}' of node '${edge.to}' has more than one incoming edge.`);
        toPortUse.add(key);
    }

    if (errors.length === 0 && topologicalDepths(spec) === undefined) {
        errors.push('The edges contain a cycle. A workflow must be a directed acyclic graph.');
    }
    return errors;
}

/** Longest-path depth per node key, or undefined when the graph has a cycle. */
function topologicalDepths(spec: WorkflowSpec): Map<string, number> | undefined {
    const depth = new Map<string, number>();
    const indegree = new Map<string, number>();
    const outgoing = new Map<string, string[]>();
    for (const n of spec.nodes) {
        depth.set(n.key, 0);
        indegree.set(n.key, 0);
        outgoing.set(n.key, []);
    }
    for (const e of spec.edges ?? []) {
        outgoing.get(e.from)?.push(e.to);
        indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
    }
    const queue = spec.nodes.filter(n => indegree.get(n.key) === 0).map(n => n.key);
    let visited = 0;
    while (queue.length > 0) {
        const key = queue.shift()!;
        visited++;
        for (const next of outgoing.get(key) ?? []) {
            depth.set(next, Math.max(depth.get(next) ?? 0, (depth.get(key) ?? 0) + 1));
            indegree.set(next, (indegree.get(next) ?? 1) - 1);
            if (indegree.get(next) === 0) queue.push(next);
        }
    }
    return visited === spec.nodes.length ? depth : undefined;
}

export function assembleWorkflow(spec: WorkflowSpec, catalog: NodeCatalog, newId: () => string = randomHex64): AssembleResult {
    const errors = validateSpec(spec, catalog);
    if (errors.length > 0) return { ok: false, errors };

    const warnings: string[] = [];
    const depths = topologicalDepths(spec)!;
    const rowAtDepth = new Map<number, number>();

    const nodes = spec.nodes.map(specNode => {
        const entry = catalog[specNode.nodeId];
        const depth = depths.get(specNode.key) ?? 0;
        const row = rowAtDepth.get(depth) ?? 0;
        rowAtDepth.set(depth, row + 1);
        const position = { x: depth * X_STEP, y: row * Y_STEP };

        const connected = (spec.edges ?? []).some(e => e.from === specNode.key || e.to === specNode.key);
        if (!connected && spec.nodes.length > 1) warnings.push(`Node '${specNode.key}' is not connected to any other node.`);

        const data = JSON.parse(JSON.stringify(entry));
        data.properties = { ...(entry.properties ?? {}), ...(specNode.properties ?? {}) };
        return {
            id: specNode.key,
            type: 'BaseNode',
            position,
            positionAbsolute: { ...position },
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
            selected: false,
            dragging: false,
            data
        };
    });

    const edges = (spec.edges ?? []).map(e => ({
        id: `reactflow__edge-${e.from}${e.fromPort}-${e.to}${e.toPort}`,
        type: 'BaseEdge',
        source: e.from,
        sourceHandle: e.fromPort,
        target: e.to,
        targetHandle: e.toPort
    }));

    return { ok: true, workflow: { id: newId(), name: spec.name.trim(), active: false, nodes, edges }, warnings };
}

export function slugify(name: string): string {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    return slug || 'workflow';
}
