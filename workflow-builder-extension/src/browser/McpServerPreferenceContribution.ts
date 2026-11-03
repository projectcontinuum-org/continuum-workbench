import { inject, injectable } from '@theia/core/shared/inversify';
import { ILogger, PreferenceContribution, PreferenceSchemaService } from '@theia/core';
import { EnvVariablesServer } from '@theia/core/lib/common/env-variables';
import { MCP_SERVER_KEY } from './WorkflowBuilderPrompt';
import { MCP_URL_ENV_VAR, resolveMcpUrl } from '../common/McpServerUrl';

const MCP_SERVERS_PREF = 'ai-features.mcp.mcpServers';

/**
 * Registers the api-server MCP server as an application default. The URL is read from the Theia backend's
 * environment, so it can be set per deployment. User or workspace settings still override it.
 */
@injectable()
export class McpServerPreferenceContribution implements PreferenceContribution {
    @inject(EnvVariablesServer)
    protected readonly envServer: EnvVariablesServer;

    @inject(ILogger)
    protected readonly logger: ILogger;

    async initSchema(service: PreferenceSchemaService): Promise<void> {
        try {
            const env = await this.envServer.getValue(MCP_URL_ENV_VAR);
            const { url, warning } = resolveMcpUrl(env?.value);
            if (warning) {
                this.logger.warn(warning);
            }
            service.registerOverride(MCP_SERVERS_PREF, undefined, { [MCP_SERVER_KEY]: { serverUrl: url, autostart: true } });
        } catch (e) {
            this.logger.error('Could not register the Continuum MCP server default.', e);
        }
    }
}
