import { injectable } from "@theia/core/shared/inversify";
import { INodeExplorerTreeItem } from "@continuum/core";
import { API_SERVER_BASE } from "./ApiConfig";

@injectable()
export default class NodeExplorerService {

    private readonly apiBaseUrl: string = `${API_SERVER_BASE}/api/v1/node-explorer`;

    async getChildren(parentId: string = ""): Promise<INodeExplorerTreeItem[]> {
        const url = new URL(`${this.apiBaseUrl}/children`, window.location.origin);
        if (parentId) {
            url.searchParams.append('parentId', parentId);
        }
        const response = await fetch(url.toString());
        return response.json();
    }

    async getDocumentation(nodeId: string): Promise<string> {
        const url = `${this.apiBaseUrl}/nodes/${encodeURIComponent(nodeId)}/documentation`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Documentation not found: ${response.status} ${response.statusText}`);
        }
        return response.text();
    }

    async search(query: string): Promise<INodeExplorerTreeItem[]> {
        if (!query.trim()) return [];
        const url = new URL(`${this.apiBaseUrl}/search`, window.location.origin);
        url.searchParams.append('query', query);
        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`Search failed: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
}
