import { injectable } from "@theia/core/shared/inversify";
import { INodeExplorerTreeItem } from "@continuum/core";
import { nodeExplorerApi, reply, requireOk } from "./ApiClients";

@injectable()
export default class NodeExplorerService {

    async getChildren(parentId: string = ""): Promise<INodeExplorerTreeItem[]> {
        const response = await reply(nodeExplorerApi.listNodeExplorerChildren({ parentId: parentId || undefined }));
        requireOk(response, 'load node explorer children');
        // NodeExplorerItem is the wire shape of INodeExplorerTreeItem (the core type carries the editor's own node types).
        return response.data as unknown as INodeExplorerTreeItem[];
    }

    async getDocumentation(nodeId: string): Promise<string> {
        // Markdown, not JSON: keep axios from parsing a document that happens to look like JSON.
        const response = await reply(nodeExplorerApi.getNodeDocumentation(
            { nodeId },
            { responseType: 'text', transformResponse: (body) => body },
        ));
        if (!response.ok) {
            throw new Error(`Documentation not found: ${response.status} ${response.statusText}`);
        }
        return response.data;
    }

    async search(query: string): Promise<INodeExplorerTreeItem[]> {
        if (!query.trim()) return [];
        const response = await reply(nodeExplorerApi.searchNodes({ query }));
        requireOk(response, 'search nodes');
        return response.data as unknown as INodeExplorerTreeItem[];
    }
}
