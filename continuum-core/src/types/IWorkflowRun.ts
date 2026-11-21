export interface IWorkflowRunItem {
    workflowId: string;
    workflowType: string;
    workflowUri: string;
    status: string;
    progressPercentage: number;
    createdAt: string;
    updatedAt: string;
}

/**
 * A page of runs as the workbench uses it: flat paging numbers. The api-server sends Spring's `PagedModel`
 * (numbers under `page`); `WorkflowRunsService` converts it with `readRunsPage`. Never cast a response to this type.
 */
export interface PageResponse<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
}

export default IWorkflowRunItem;
