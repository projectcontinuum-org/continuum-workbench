import IWorkflow from "./IWorkflow";

export interface ICreateWorkflowScheduleRequest {
    name: string;
    cronExpression: string;
    timeZone?: string;
    continuumWorkflowModel: IWorkflow;
}
