import { networkFailure, NodeDataResult, toNodeDataResult } from "../../common/NodeDataResult";
import { requirePathSegment } from "../../common/SafeEncoding";
import type { NodeOutputPage } from "../../generated/api-server";
import { nodeOutputsApi, reply } from "./ApiClients";

export type DataPage = NodeOutputPage;

export default class DataService {

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
        try {
            const response = await reply(nodeOutputsApi.getNodeOutputPage({
                runId: requirePathSegment(parts[0]),
                nodeId: requirePathSegment(parts[1]),
                outputId: requirePathSegment(parts[2].split(".")[1]),
                page,
                pageSize: limit,
            }));
            return await toNodeDataResult<DataPage>(response);
        } catch (e) {
            return networkFailure(e);
        }
    }
}
