import { injectable } from "@theia/core/shared/inversify";
import { IWorkflowRunItem, PageResponse } from "@continuum/core";
import { requirePathSegment, rsqlComparison } from "../../common/SafeEncoding";
import { readRunsPage } from "../../common/RunsPage";
import { reply, requireOk, workflowRunsApi } from "./ApiClients";

/** Full workflow run entity including the heavy `data` JSONB column */
export interface WorkflowRunFull extends IWorkflowRunItem {
    data: {
        workflowSnapshot?: any;
        nodeToOutputMap?: any;
    };
}

@injectable()
export default class WorkflowRunsService {

    async getDistinctWorkflows(filter?: string, page = 0, size = 50): Promise<PageResponse<string>> {
        const response = await reply(workflowRunsApi.listRunWorkflowUris({ filter: filter || undefined, page, size }));
        requireOk(response, 'fetch distinct workflows');
        return readRunsPage<string>(response.data);
    }

    async getRunsByWorkflowUri(workflowUri: string, timeFilter?: string, page = 0, size = 50): Promise<PageResponse<IWorkflowRunItem>> {
        // Build RSQL filter combining workflowUri and optional time range
        let filter = rsqlComparison("workflowUri", "==", workflowUri);
        if (timeFilter) {
            filter = `${filter};${timeFilter}`;
        }
        const response = await reply(workflowRunsApi.listWorkflowRuns({ filter, page, size }));
        requireOk(response, 'fetch workflow runs');
        return readRunsPage<IWorkflowRunItem>(response.data);
    }

    /**
     * Fetch a single workflow run by ID, including the full `data` column
     * (workflowSnapshot + nodeToOutputMap). Used by the execution viewer.
     */
    async getRunById(workflowId: string): Promise<WorkflowRunFull> {
        const response = await reply(workflowRunsApi.getWorkflowRun({ workflowId: requirePathSegment(workflowId) }));
        requireOk(response, 'fetch workflow run');
        return response.data;
    }
}
