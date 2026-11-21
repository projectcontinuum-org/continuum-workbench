/** Mirrors `ContinuumWorkflowModel.EdgeStatus` in continuum-platform-core; keep both in sync. No status means the source has not finished yet. */
export enum EdgeStatus {
    /** The source finished and produced the edge's source port. */
    DELIVERED = "DELIVERED",
    /** The edge will never carry data: its source failed or was skipped, or finished without producing the port. */
    BROKEN = "BROKEN"
}

/** Runtime state of an edge, set by the orchestrator on the edge's React Flow `data`. */
export interface IEdgeData {
    status?: EdgeStatus;
}
