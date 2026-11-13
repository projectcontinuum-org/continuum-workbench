import { API_SERVER_BASE } from "./ApiConfig";
import { buildApiUrl } from "../../common/SafeEncoding";

export interface DataPage {
    data: any[];
    currentPage: number;
    currentPageSize: number;
    totalPages: number;
    totalElements: number;
    hasNext: number;
    hasPrevious: number;
}

export default class DataService {
    private readonly apiBaseUrl: string = `${API_SERVER_BASE}/api/v1/data`;

    async getNodeData(
      filePath: string,
      page: number,
      limit: number
    ): Promise<DataPage> {
        const parts = filePath.replace("{remote}", "").split("/");
        const workflowId = parts[0];
        const nodeId = parts[1];
        const outputId = parts[2].split(".")[1];
        const response = await fetch(buildApiUrl(this.apiBaseUrl, [workflowId, "nodes", nodeId, "outputs", outputId], { page, pageSize: limit }));
        return response.json();
    }
}