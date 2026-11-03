import { injectable, inject } from '@theia/core/shared/inversify';
import URI from '@theia/core/lib/common/uri';
import { open, OpenerService } from '@theia/core/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { ToolProvider, ToolRequest } from '@theia/ai-core/lib/common';
import { NodeCatalogService } from './NodeCatalogService';
import { assembleWorkflow, slugify, WorkflowSpec } from '../common/WorkflowAssembler';

export const CREATE_WORKFLOW_ID = 'createContinuumWorkflow';

@injectable()
export class CreateWorkflowTool implements ToolProvider {
    @inject(NodeCatalogService)
    protected readonly catalog: NodeCatalogService;

    @inject(FileService)
    protected readonly fileService: FileService;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(OpenerService)
    protected readonly openerService: OpenerService;

    getTool(): ToolRequest {
        return {
            id: CREATE_WORKFLOW_ID,
            name: CREATE_WORKFLOW_ID,
            description: 'Validates a workflow spec against the node registry, builds the full Continuum workflow, saves it as a .cwf file in the ' +
                'workspace and opens it in the workflow editor. Returns validation errors instead of saving when the spec is invalid; fix them and call again. ' +
                'Send only this compact spec, never the full workflow JSON.',
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Short human-readable workflow name.' },
                    nodes: {
                        type: 'array',
                        description: 'The nodes of the workflow.',
                        items: {
                            type: 'object',
                            properties: {
                                key: { type: 'string', description: 'Unique id of this node inside the workflow, e.g. "1" or "summarize".' },
                                nodeId: { type: 'string', description: 'Exact node id from getContinuumNodeMetadata.' },
                                properties: {
                                    type: 'object',
                                    description: 'Only the properties you change. Keys must exist in the node propertiesSchema. Defaults fill the rest.'
                                }
                            },
                            required: ['key', 'nodeId']
                        }
                    },
                    edges: {
                        type: 'array',
                        description: 'Connections from an output port to an input port.',
                        items: {
                            type: 'object',
                            properties: {
                                from: { type: 'string', description: 'Key of the source node.' },
                                fromPort: { type: 'string', description: 'Output port name of the source node.' },
                                to: { type: 'string', description: 'Key of the target node.' },
                                toPort: { type: 'string', description: 'Input port name of the target node.' }
                            },
                            required: ['from', 'fromPort', 'to', 'toPort']
                        }
                    }
                },
                required: ['name', 'nodes', 'edges']
            },
            handler: (argString: string) => this.handle(argString),
            getArgumentsShortLabel: (args: string) => {
                try {
                    const name = JSON.parse(args)?.name;
                    return typeof name === 'string' ? { label: name, hasMore: true } : undefined;
                } catch {
                    return undefined;
                }
            }
        };
    }

    protected async handle(argString: string): Promise<string> {
        let spec: WorkflowSpec;
        try {
            spec = JSON.parse(argString || '{}');
        } catch (e) {
            return JSON.stringify({ saved: false, errors: ['The tool arguments are not valid JSON.'] });
        }

        let catalog;
        try {
            catalog = await this.catalog.getCatalog();
        } catch (e) {
            return JSON.stringify({ saved: false, errors: [`Cannot reach the node registry: ${e instanceof Error ? e.message : String(e)}`] });
        }

        const result = assembleWorkflow(spec, catalog);
        if (!result.ok) {
            return JSON.stringify({ saved: false, errors: result.errors });
        }

        const roots = await this.workspaceService.roots;
        if (roots.length === 0) {
            return JSON.stringify({ saved: false, errors: ['No folder is open in the workbench. Ask the user to open a folder, then call the tool again.'] });
        }

        const target = await this.freeUri(roots[0].resource, slugify(result.workflow.name));
        await this.fileService.create(target, JSON.stringify(result.workflow, null, 4));
        await open(this.openerService, target);

        return JSON.stringify({
            saved: true,
            file: target.path.toString(),
            nodeCount: result.workflow.nodes.length,
            edgeCount: result.workflow.edges.length,
            warnings: result.warnings
        });
    }

    protected async freeUri(root: URI, slug: string): Promise<URI> {
        for (let i = 1; i < 1000; i++) {
            const candidate = root.resolve(i === 1 ? `${slug}.cwf` : `${slug}-${i}.cwf`);
            if (!(await this.fileService.exists(candidate))) {
                return candidate;
            }
        }
        throw new Error(`Could not find a free file name for '${slug}'.`);
    }
}
