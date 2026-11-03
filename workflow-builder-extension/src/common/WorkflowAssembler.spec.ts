import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assembleWorkflow, NodeCatalog, slugify, WorkflowSpec } from './WorkflowAssembler';

const catalog: NodeCatalog = {
    'x.Create': {
        id: 'x.Create', title: 'Create', description: '', nodeModel: 'x.Create',
        outputs: { data: { name: 'out' } },
        properties: { rows: '[]' },
        propertiesSchema: { type: 'object', properties: { rows: { type: 'string' } } }
    },
    'x.Agent': {
        id: 'x.Agent', title: 'Agent', description: '', nodeModel: 'x.Agent',
        inputs: { input: { name: 'in' } }, outputs: { output: { name: 'out' } },
        properties: { backend: 'ANTHROPIC', maxTurns: 10 },
        propertiesSchema: {
            type: 'object', required: ['prompt'],
            properties: {
                backend: { type: 'string', enum: ['ANTHROPIC', 'OLLAMA'] },
                maxTurns: { type: 'integer' },
                prompt: { type: 'string' }
            }
        }
    },
    'x.Split': {
        id: 'x.Split', title: 'Split', description: '', nodeModel: 'x.Split',
        inputs: { data: { name: 'in' } }, outputs: { high: {}, low: {} },
        propertiesSchema: { type: 'object', properties: {} }
    }
};

const valid = (): WorkflowSpec => ({
    name: 'Triage Demo',
    nodes: [
        { key: '1', nodeId: 'x.Create' },
        { key: '2', nodeId: 'x.Agent', properties: { prompt: 'Hello ${row.a!}', maxTurns: 5 } },
        { key: '3', nodeId: 'x.Split' }
    ],
    edges: [
        { from: '1', fromPort: 'data', to: '2', toPort: 'input' },
        { from: '2', fromPort: 'output', to: '3', toPort: 'data' }
    ]
});

const errorsOf = (spec: WorkflowSpec): string[] => {
    const r = assembleWorkflow(spec, catalog);
    assert.equal(r.ok, false);
    return r.ok ? [] : r.errors;
};

test('valid spec assembles a workflow with the fields the API requires', () => {
    const r = assembleWorkflow(valid(), catalog, () => 'a'.repeat(64));
    assert.equal(r.ok, true);
    if (!r.ok) return;
    const wf = r.workflow;
    assert.deepEqual({ id: wf.id, name: wf.name, active: wf.active }, { id: 'a'.repeat(64), name: 'Triage Demo', active: false });
    for (const n of wf.nodes) {
        assert.equal(n.type, 'BaseNode');
        assert.equal(n.selected, false);
        assert.equal(n.dragging, false);
        assert.deepEqual(n.positionAbsolute, n.position);
        assert.equal(typeof n.width, 'number');
    }
    assert.deepEqual(wf.nodes.map(n => n.position.x), [0, 330, 660]);
    assert.deepEqual(wf.nodes[1].data.properties, { backend: 'ANTHROPIC', maxTurns: 5, prompt: 'Hello ${row.a!}' });
    assert.equal(wf.nodes[1].data.id, 'x.Agent');
    assert.deepEqual(wf.edges[0], {
        id: 'reactflow__edge-1data-2input', type: 'BaseEdge',
        source: '1', sourceHandle: 'data', target: '2', targetHandle: 'input'
    });
});

test('assembling does not mutate the catalog', () => {
    const before = JSON.stringify(catalog);
    assembleWorkflow(valid(), catalog);
    assert.equal(JSON.stringify(catalog), before);
});

test('unknown node id is reported', () => {
    const spec = valid();
    spec.nodes[0].nodeId = 'x.Nope';
    assert.match(errorsOf(spec).join('\n'), /unknown nodeId 'x\.Nope'/);
});

test('unknown output and input ports are reported with the valid names', () => {
    const spec = valid();
    spec.edges[0].fromPort = 'out';
    spec.edges[1].toPort = 'in';
    const text = errorsOf(spec).join('\n');
    assert.match(text, /no output port 'out'.*data/);
    assert.match(text, /no input port 'in'.*data/);
});

test('edge to a missing node key is reported', () => {
    const spec = valid();
    spec.edges[0].to = '99';
    assert.match(errorsOf(spec).join('\n'), /target node key '99' does not exist/);
});

test('cycle is reported', () => {
    const spec: WorkflowSpec = {
        name: 'c',
        nodes: [{ key: 'a', nodeId: 'x.Agent', properties: { prompt: 'p' } }, { key: 'b', nodeId: 'x.Agent', properties: { prompt: 'p' } }],
        edges: [
            { from: 'a', fromPort: 'output', to: 'b', toPort: 'input' },
            { from: 'b', fromPort: 'output', to: 'a', toPort: 'input' }
        ]
    };
    assert.match(errorsOf(spec).join('\n'), /cycle/);
});

test('unknown, mistyped and out-of-enum properties are reported', () => {
    const spec = valid();
    spec.nodes[1].properties = { prompt: 'p', bogus: 1, maxTurns: '5', backend: 'GPT' };
    const text = errorsOf(spec).join('\n');
    assert.match(text, /unknown property 'bogus'/);
    assert.match(text, /'maxTurns' must be of type integer, got string/);
    assert.match(text, /'backend' must be one of/);
});

test('missing required property is reported, defaults count', () => {
    const spec = valid();
    spec.nodes[1].properties = { maxTurns: 3 };
    assert.match(errorsOf(spec).join('\n'), /required property 'prompt'/);
});

test('duplicate keys, duplicate and doubly fed ports are reported', () => {
    const spec = valid();
    spec.nodes.push({ key: '1', nodeId: 'x.Create' });
    assert.match(errorsOf(spec).join('\n'), /Node key '1' is used more than once/);

    const fan: WorkflowSpec = valid();
    fan.nodes.push({ key: '4', nodeId: 'x.Create' });
    fan.edges.push({ from: '4', fromPort: 'data', to: '2', toPort: 'input' });
    assert.match(errorsOf(fan).join('\n'), /more than one incoming edge/);
});

test('empty workflow and missing name are reported', () => {
    assert.match(errorsOf({ name: '', nodes: [], edges: [] }).join('\n'), /at least one node|non-empty name/);
});

test('disconnected node yields a warning, not an error', () => {
    const spec = valid();
    spec.nodes.push({ key: '9', nodeId: 'x.Create' });
    const r = assembleWorkflow(spec, catalog);
    assert.equal(r.ok, true);
    if (r.ok) assert.match(r.warnings.join('\n'), /Node '9' is not connected/);
});

test('slugify', () => {
    assert.equal(slugify('Adverse Event Triage (openFDA)'), 'adverse-event-triage-openfda');
    assert.equal(slugify('###'), 'workflow');
});

test('resolveMcpUrl: default, override, blank and invalid values', async () => {
    const { resolveMcpUrl, DEFAULT_MCP_URL } = await import('./McpServerUrl');
    assert.deepEqual(resolveMcpUrl(undefined), { url: 'http://localhost:8080/mcp' });
    assert.deepEqual(resolveMcpUrl('  '), { url: DEFAULT_MCP_URL });
    assert.deepEqual(resolveMcpUrl(' http://continuum-api-server:8080/mcp '), { url: 'http://continuum-api-server:8080/mcp' });
    assert.equal(resolveMcpUrl('https://x.example/mcp').warning, undefined);
    assert.match(resolveMcpUrl('not a url').warning ?? '', /not a valid http\(s\) URL/);
    assert.match(resolveMcpUrl('ftp://host/mcp').warning ?? '', /using http:\/\/localhost:8080\/mcp/);
});
