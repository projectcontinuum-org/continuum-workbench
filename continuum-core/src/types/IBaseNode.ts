import { MimeTypes } from "../model/MimeTypes";
import type { JsonSchema } from '@jsonforms/core';

/** Mirrors `ContinuumWorkflowModel.NodeStatus` in continuum-platform-core; keep both in sync. */
export enum NodeStatus {
    ACTIVE = "ACTIVE",
    CONFIGURED = "CONFIGURED",
    SCHEDULED = "SCHEDULED",
    BUSY = "BUSY",
    SUCCESS = "SUCCESS",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED",
    WARNING = "WARNING",
    PRE_PROCESSING = "PRE_PROCESSING",
    POST_PROCESSING = "POST_PROCESSING",
    SKIPPED = "SKIPPED"
}

export interface IBaseNodeData {
    id: string;
    description: string;
    title: string;
    icon?: string;
    subTitle?: string;
    inputs?: IPorts;
    outputs?: IPorts;
    properties?: {[key: string]: any};
    propertiesSchema?: JsonSchema;
    propertiesUISchema?: any;
    credentials?: {[key: string]: any};
    nodeModel: string;
    status?: NodeStatus;
    nodeProgress?: INodeProgress;
    retryOptions?: IRetryOptions;
}

export interface IRetryOptions {
    initialIntervalSeconds?: number;
    backoffCoefficient?: number;
    maximumIntervalSeconds?: number;
    maximumAttempts?: number;
    doNotRetry?: string[];
}

export interface INodeProgress {
  progressPercentage: number;
  message?: string;
  stageStatus?: {[key: string]: StageStatus};
  stageDurationMs?: number;
  totalDurationMs?: number;
}

export enum StageStatus {
    PENDING = "PENDING",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    SKIPPED = "SKIPPED"
}

export interface IPortProps {
    name:string;
    contentType: MimeTypes;
}

export interface IPorts {
    [key: string]: IPortProps
}

export interface IData {
    status: "SUCCESS" | "FAILED" | "WARNING"
    contentType: MimeTypes,
    data: any
}

export interface INodeOutputs {
    [id: string]: IData
}
