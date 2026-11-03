import { injectable } from '@theia/core/shared/inversify';
import { AbstractStreamParsingChatAgent } from '@theia/ai-chat/lib/common/chat-agents';
import { LanguageModelRequirement } from '@theia/ai-core/lib/common';
import { WORKFLOW_BUILDER_PROMPT_ID, workflowBuilderPrompt } from './WorkflowBuilderPrompt';

export const WorkflowBuilderAgentId = 'continuum-workflow-builder';

@injectable()
export class WorkflowBuilderAgent extends AbstractStreamParsingChatAgent {
    name = 'WorkflowBuilder';
    id = WorkflowBuilderAgentId;
    languageModelRequirements: LanguageModelRequirement[] = [{
        purpose: 'chat',
        identifier: 'default/universal'
    }];
    protected defaultLanguageModelPurpose: string = 'chat';
    override description = 'Builds a Continuum workflow from a plain-language request. It looks up the available nodes and their documentation ' +
        'in the Continuum node registry, then saves a validated .cwf file in the workspace and opens it.';

    override prompts = [{ id: WORKFLOW_BUILDER_PROMPT_ID, defaultVariant: workflowBuilderPrompt, variants: [] }];
    protected override systemPromptId: string = WORKFLOW_BUILDER_PROMPT_ID;
    override iconClass: string = 'fa fa-solid fa-diagram-project';
}
