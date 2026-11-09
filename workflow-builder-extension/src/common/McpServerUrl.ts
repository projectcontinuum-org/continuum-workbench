export const MCP_URL_ENV_VAR = 'CONTINUUM_API_SERVER_MCP_URL';
export const DEFAULT_MCP_URL = 'http://localhost:8080/mcp';

/** Returns the configured MCP endpoint, or the default when the variable is unset, blank or not an http(s) URL. */
export function resolveMcpUrl(value: string | undefined): { url: string; warning?: string } {
    const trimmed = value?.trim();
    if (!trimmed) {
        return { url: DEFAULT_MCP_URL };
    }
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return { url: trimmed };
        }
    } catch {
        // fall through to the warning
    }
    return { url: DEFAULT_MCP_URL, warning: `${MCP_URL_ENV_VAR} is not a valid http(s) URL ('${trimmed}'); using ${DEFAULT_MCP_URL}.` };
}
