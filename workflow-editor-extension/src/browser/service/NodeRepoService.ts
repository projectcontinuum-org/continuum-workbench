import { INodeRepoTreeItem } from "@continuum/core";
import { API_SERVER_BASE } from "./ApiConfig";

export default class NodeRepoService {

    private readonly apiBaseUrl: string = `${API_SERVER_BASE}/api/v1/node-repo`;

    async getNodeRepoTree(): Promise<INodeRepoTreeItem[]> {
        const response = await fetch(this.apiBaseUrl);
        return response.json();
    }
}