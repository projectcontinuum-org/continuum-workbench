import { injectable } from '@theia/core/shared/inversify';
import { API_SERVER_BASE } from '@continuum/workflow-editor-extension/lib/browser/service/ApiConfig';
import { CatalogNode, NodeCatalog } from '../common/WorkflowAssembler';

interface ExplorerItem {
    id: string;
    name: string;
    type: 'CATEGORY' | 'NODE';
    hasChildren: boolean;
    nodeInfo?: CatalogNode;
    children?: ExplorerItem[];
}

const CACHE_MS = 60_000;

@injectable()
export class NodeCatalogService {
    protected readonly baseUrl = `${API_SERVER_BASE}/api/v1/node-explorer`;
    protected cache?: { at: number; catalog: NodeCatalog };

    async getCatalog(): Promise<NodeCatalog> {
        if (this.cache && Date.now() - this.cache.at < CACHE_MS) {
            return this.cache.catalog;
        }
        const catalog: NodeCatalog = {};
        await this.crawl('', catalog, new Set());
        if (Object.keys(catalog).length === 0) {
            throw new Error(`The node registry at ${this.baseUrl} returned no nodes.`);
        }
        this.cache = { at: Date.now(), catalog };
        return catalog;
    }

    async getDocumentation(nodeId: string): Promise<string> {
        const response = await fetch(`${this.baseUrl}/nodes/${encodeURIComponent(nodeId)}/documentation`);
        if (!response.ok) {
            throw new Error(`No documentation for '${nodeId}': HTTP ${response.status}`);
        }
        return response.text();
    }

    protected async crawl(parentId: string, catalog: NodeCatalog, visited: Set<string>): Promise<void> {
        if (visited.has(parentId)) return;
        visited.add(parentId);
        const url = new URL(`${this.baseUrl}/children`, window.location.origin);
        if (parentId) url.searchParams.append('parentId', parentId);
        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`Node registry request failed: HTTP ${response.status} for ${url.pathname}`);
        }
        const items: ExplorerItem[] = await response.json();
        await Promise.all(items.map(async item => {
            if (item.type === 'NODE' && item.nodeInfo) {
                catalog[item.nodeInfo.id] = item.nodeInfo;
            }
            if (item.type === 'CATEGORY' || item.hasChildren) {
                await this.crawl(item.id, catalog, visited);
            }
        }));
    }
}
