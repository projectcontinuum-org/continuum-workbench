export interface IWorkflowRunItem {
    workflowId: string;
    workflowType: string;
    workflowUri: string;
    status: string;
    progressPercentage: number;
    createdAt: string;
    updatedAt: string;
}

export interface PageResponse<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
}

export default IWorkflowRunItem;
