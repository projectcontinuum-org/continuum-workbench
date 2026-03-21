import { injectable } from "@theia/core/shared/inversify";
import { IWorkflowRunItem, PageResponse } from "@continuum/core";

/** Full workflow run entity including the heavy `data` JSONB column */
export interface WorkflowRunFull extends IWorkflowRunItem {
    data: {
        workflowSnapshot?: any;
        nodeToOutputMap?: any;
    };
}

@injectable()
export default class WorkflowRunsService {

    private readonly apiBaseUrl: string = 'http://localhost:8080/api/v1/workflow-runs';

    private get headers(): Record<string, string> {
        return {
            'Content-type': 'application/json; charset=UTF-8',
            'x-continuum-user-id': 'L001418' // Replace with dynamic user ID retrieval as needed
        };
    }

    async getDistinctWorkflows(filter?: string, page = 0, size = 50): Promise<PageResponse<string>> {
        const url = new URL(`${this.apiBaseUrl}/distinct-workflows`);
        url.searchParams.append('page', page.toString());
        url.searchParams.append('size', size.toString());
        if (filter) {
            url.searchParams.append('filter', filter);
        }
        const response = await fetch(url.toString(), { headers: this.headers });
        if (!response.ok) {
            throw new Error(`Failed to fetch distinct workflows: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }

    async getRunsByWorkflowUri(workflowUri: string, timeFilter?: string, page = 0, size = 50): Promise<PageResponse<IWorkflowRunItem>> {
        const url = new URL(this.apiBaseUrl);
        url.searchParams.append('page', page.toString());
        url.searchParams.append('size', size.toString());

        // Build RSQL filter combining workflowUri and optional time range
        let filter = `workflowUri==${workflowUri}`;
        if (timeFilter) {
            filter = `${filter};${timeFilter}`;
        }
        url.searchParams.append('filter', filter);

        const response = await fetch(url.toString(), { headers: this.headers });
        if (!response.ok) {
            throw new Error(`Failed to fetch workflow runs: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }

    /**
     * Fetch a single workflow run by ID, including the full `data` column
     * (workflowSnapshot + nodeToOutputMap). Used by the execution viewer.
     */
    async getRunById(workflowId: string): Promise<WorkflowRunFull> {
        const url = new URL(`${this.apiBaseUrl}/${workflowId}`);
        const response = await fetch(url.toString(), { headers: this.headers });
        if (!response.ok) {
            throw new Error(`Failed to fetch workflow run: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
}
