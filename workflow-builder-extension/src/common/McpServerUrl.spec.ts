import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MCP_URL, resolveMcpUrl } from './McpServerUrl';

test('resolveMcpUrl: default, override, blank and invalid values', () => {
    assert.deepEqual(resolveMcpUrl(undefined), { url: 'http://localhost:8080/mcp' });
    assert.deepEqual(resolveMcpUrl('  '), { url: DEFAULT_MCP_URL });
    assert.deepEqual(resolveMcpUrl(' http://continuum-api-server:8080/mcp '), { url: 'http://continuum-api-server:8080/mcp' });
    assert.equal(resolveMcpUrl('https://x.example/mcp').warning, undefined);
    assert.match(resolveMcpUrl('not a url').warning ?? '', /not a valid http\(s\) URL/);
    assert.match(resolveMcpUrl('ftp://host/mcp').warning ?? '', /using http:\/\/localhost:8080\/mcp/);
});
