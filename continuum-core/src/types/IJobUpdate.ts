import IWorkflow from "./IWorkflow"
import INodeToOutputsMap from "./INodeToOutputsMap"

export default interface IJobUpdate {
    executionUUID: string;
    progressPercentage?: number;
    status: "PENDING" | "RUNNING" | "FINISHED" | "FAILED" | "WARNING" | "CANCELLED" | "CANCELLING" |
        "TERMINATING" | "TERMINATED" | "PAUSED" | "UPLOADING_RESULTS" | "DOWNLOADING_RESULTS";
    nodeToOutputsMap: INodeToOutputsMap;
    createdAtTimestampUtc: number;
    updatesAtTimestampUtc: number;
    workflow: IWorkflow;
    historyEventCount?: number;
    historyEventLimit?: number;
}