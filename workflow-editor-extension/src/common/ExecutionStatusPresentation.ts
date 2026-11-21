/**
 * How each node and edge execution status reported by the workflow is shown. Pure data with no React, MUI or Theia
 * imports, so it runs under `node --test` (see ExecutionStatusPresentation.spec.ts). The string values match
 * `NodeStatus` / `EdgeStatus` in `@continuum/core`, which mirror `ContinuumWorkflowModel` in continuum-platform-core.
 */

export type NodeStatusValue =
    | "ACTIVE" | "CONFIGURED" | "SCHEDULED" | "BUSY" | "SUCCESS" | "FAILED" | "CANCELLED" | "WARNING"
    | "PRE_PROCESSING" | "POST_PROCESSING" | "SKIPPED";

export type EdgeStatusValue = "DELIVERED" | "BROKEN";

export type NodeStatusBadge = "scheduled" | "success" | "failed" | "warning" | "active" | "cancelled" | "skipped";

export interface NodeStatusPresentation {
    label: string;
    /** MUI palette colour of the status caption. */
    color: string;
    /** What the status means, shown as the badge tooltip. */
    description: string;
    badge?: NodeStatusBadge;
    /** The activity is doing work: show a progress indicator instead of the badge. */
    working: boolean;
}

// Record<NodeStatusValue, ...> makes the compiler flag a status added to the type but not given a presentation here.
export const NODE_STATUS_PRESENTATION: Record<NodeStatusValue, NodeStatusPresentation> = {
    ACTIVE: { label: "Active", color: "warning.main", description: "Active", badge: "active", working: false },
    CONFIGURED: { label: "Configured", color: "text.secondary", description: "Configured", working: false },
    SCHEDULED: {
        label: "Scheduled",
        color: "info.main",
        description: "Dispatched, waiting for a worker to pick it up",
        badge: "scheduled",
        working: false
    },
    BUSY: { label: "Busy", color: "info.main", description: "Running", working: true },
    PRE_PROCESSING: { label: "Pre-processing", color: "info.main", description: "Preparing inputs", working: true },
    POST_PROCESSING: { label: "Post-processing", color: "info.main", description: "Writing outputs", working: true },
    SUCCESS: { label: "Success", color: "success.main", description: "Succeeded", badge: "success", working: false },
    FAILED: { label: "Failed", color: "error.main", description: "Failed", badge: "failed", working: false },
    WARNING: { label: "Warning", color: "warning.main", description: "Finished with warnings", badge: "warning", working: false },
    CANCELLED: {
        label: "Cancelled",
        color: "text.disabled",
        description: "Stopped because the run was cancelled",
        badge: "cancelled",
        working: false
    },
    SKIPPED: {
        label: "Skipped",
        color: "text.disabled",
        description: "Not run: an input will never receive data",
        badge: "skipped",
        working: false
    }
};

/** Presentation of a node status; a status this build does not know is shown as-is, with no badge. */
export function nodeStatusPresentation(status: string): NodeStatusPresentation {
    return NODE_STATUS_PRESENTATION[status as NodeStatusValue]
        ?? { label: status, color: "text.secondary", description: status, working: false };
}

/** CSS class put on the node body for a status, e.g. `node-status--skipped`; none for no status. */
export function nodeStatusClass(status: string | undefined): string | undefined {
    return status ? `node-status--${status.toLowerCase()}` : undefined;
}

export interface EdgeStatusPresentation {
    className: string;
    title: string;
    /** Draw the broken-wire mark at the edge midpoint. */
    breakMark: boolean;
}

export const EDGE_STATUS_PRESENTATION: Record<EdgeStatusValue, EdgeStatusPresentation> = {
    DELIVERED: { className: "continuum-edge--delivered", title: "Delivered: data flowed on this connection", breakMark: false },
    BROKEN: { className: "continuum-edge--broken", title: "Broken: no data will flow on this connection", breakMark: true }
};

/**
 * Presentation of an edge status, or undefined when there is none: the source has not finished, the run predates
 * edge statuses, or this build does not know the value. Those edges are drawn as plain wires.
 */
export function edgeStatusPresentation(status: string | undefined): EdgeStatusPresentation | undefined {
    return status ? EDGE_STATUS_PRESENTATION[status as EdgeStatusValue] : undefined;
}
