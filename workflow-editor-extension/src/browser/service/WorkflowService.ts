import { IWorkflow } from "@continuum/core";
import { IStartWorkflowResponse } from "@continuum/core";
import { injectable } from "@theia/core/shared/inversify";
import type { ContinuumWorkflowModel } from "../../generated/api-server";
import { requirePathSegment } from "../../common/SafeEncoding";
import { readStartedWorkflowId, startNetworkFailure, StartWorkflowError } from "../../common/StartWorkflowResult";
import { reply, requireOk, workflowsApi } from "./ApiClients";

@injectable()
export default class WorkflowService {

    /**
     * Starts a workflow. Resolves only when the server really started one. Rejects with a `StartWorkflowError` (see
     * common/StartWorkflowResult.ts) carrying a message that is safe to show the user when the server refused it
     * (a 4xx or 5xx), answered without a workflow id, or could not be reached. It used to resolve with whatever the
     * body parsed to, so a failed start looked like a started workflow.
     */
    async activateWorkflow(workflow: IWorkflow): Promise<IStartWorkflowResponse> {
        try {
            // The editor's reactflow nodes are the wire shape of the spec's WorkflowNode; the server validates it.
            const response = await reply(workflowsApi.startWorkflow({
                continuumWorkflowModel: workflow as unknown as ContinuumWorkflowModel,
            }));
            return { workflowId: await readStartedWorkflowId(response) };
        } catch (error) {
            if (error instanceof StartWorkflowError) {
                throw error;
            }
            throw startNetworkFailure(error);
        }
    }

    async cancelWorkflow(workflowId: string, reason?: string): Promise<void> {
        const response = await reply(workflowsApi.cancelWorkflow({
            workflowId: requirePathSegment(workflowId),
            reason: reason || undefined,
        }));
        requireOk(response, 'cancel workflow');
    }

    async terminateWorkflow(workflowId: string, reason?: string): Promise<void> {
        const response = await reply(workflowsApi.terminateWorkflow({
            workflowId: requirePathSegment(workflowId),
            reason: reason || undefined,
        }));
        requireOk(response, 'terminate workflow');
    }
}
