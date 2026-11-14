import { buildApiUrl } from "../../common/SafeEncoding";
import { networkFailure, NodeDataResult, toNodeDataResult } from "../../common/NodeDataResult";
import { API_SERVER_BASE } from "./ApiConfig";

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

    /**
     * Reads one page of a node output. It never throws for an HTTP or network failure: it returns why instead
     * (`not-found` for a 404, `error` for anything else), so the caller cannot be left with an unhandled rejection
     * and a blank table. See common/NodeDataResult.ts for what each outcome means.
     */
    async getNodeData(
      filePath: string,
      page: number,
      limit: number
    ): Promise<NodeDataResult<DataPage>> {
        const parts = filePath.replace("{remote}", "").split("/");
        const workflowId = parts[0];
        const nodeId = parts[1];
        const outputId = parts[2].split(".")[1];
        try {
            const response = await fetch(buildApiUrl(this.apiBaseUrl, [workflowId, "nodes", nodeId, "outputs", outputId], { page, pageSize: limit }));
            return await toNodeDataResult<DataPage>(response);
        } catch (e) {
            return networkFailure(e);
        }
    }
}
