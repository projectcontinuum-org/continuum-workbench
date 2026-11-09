import { ContainerModule } from '@theia/core/shared/inversify';
import { PreferenceContribution } from '@theia/core';
import { Agent, AIVariableContribution } from '@theia/ai-core/lib/common';
import { ChatAgent } from '@theia/ai-chat/lib/common';
import { WorkflowBuilderAgent } from './WorkflowBuilderAgent';
import { McpServerPreferenceContribution } from './McpServerPreferenceContribution';
import { ActiveFileVariableContribution } from './ActiveFileVariableContribution';

export default new ContainerModule(bind => {
    bind(McpServerPreferenceContribution).toSelf().inSingletonScope();
    bind(PreferenceContribution).toService(McpServerPreferenceContribution);

    bind(ActiveFileVariableContribution).toSelf().inSingletonScope();
    bind(AIVariableContribution).toService(ActiveFileVariableContribution);

    bind(WorkflowBuilderAgent).toSelf().inSingletonScope();
    bind(Agent).toService(WorkflowBuilderAgent);
    bind(ChatAgent).toService(WorkflowBuilderAgent);
});
