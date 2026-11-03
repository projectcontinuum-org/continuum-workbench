import { injectable, inject } from '@theia/core/shared/inversify';
import { ToolProvider, ToolRequest } from '@theia/ai-core/lib/common';
import { NodeCatalogService } from './NodeCatalogService';

export const GET_NODE_DOCUMENTATION_ID = 'getContinuumNodeDocumentation';

@injectable()
export class GetNodeDocumentationTool implements ToolProvider {
    @inject(NodeCatalogService)
    protected readonly catalog: NodeCatalogService;

    getTool(): ToolRequest {
        return {
            id: GET_NODE_DOCUMENTATION_ID,
            name: GET_NODE_DOCUMENTATION_ID,
            description: 'Returns the markdown documentation of one Continuum node: what it does, every property, ports, and examples. ' +
                'Call it for each node before you configure it.',
            parameters: {
                type: 'object',
                properties: {
                    nodeId: {
                        type: 'string',
                        description: 'The exact node id (fully qualified class name) as returned by searchContinuumNodes or getContinuumNodeMetadata.'
                    }
                },
                required: ['nodeId']
            },
            handler: async (argString: string) => {
                try {
                    const { nodeId } = JSON.parse(argString || '{}');
                    if (typeof nodeId !== 'string' || !nodeId) {
                        return JSON.stringify({ error: 'nodeId is required.' });
                    }
                    return await this.catalog.getDocumentation(nodeId);
                } catch (e) {
                    return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
                }
            },
            getArgumentsShortLabel: (args: string) => {
                try {
                    const nodeId = JSON.parse(args)?.nodeId;
                    return typeof nodeId === 'string' ? { label: nodeId.split('.').pop() ?? nodeId, hasMore: false } : undefined;
                } catch {
                    return undefined;
                }
            }
        };
    }
}
