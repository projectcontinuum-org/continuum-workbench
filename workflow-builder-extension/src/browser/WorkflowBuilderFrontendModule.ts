import { ContainerModule } from '@theia/core/shared/inversify';
import { PreferenceContribution } from '@theia/core';
import { Agent, bindToolProvider } from '@theia/ai-core/lib/common';
import { ChatAgent } from '@theia/ai-chat/lib/common';
import { WorkflowBuilderAgent } from './WorkflowBuilderAgent';
import { NodeCatalogService } from './NodeCatalogService';
import { GetNodeDocumentationTool } from './GetNodeDocumentationTool';
import { CreateWorkflowTool } from './CreateWorkflowTool';
import { McpServerPreferenceContribution } from './McpServerPreferenceContribution';

export default new ContainerModule(bind => {
    bind(McpServerPreferenceContribution).toSelf().inSingletonScope();
    bind(PreferenceContribution).toService(McpServerPreferenceContribution);

    bind(NodeCatalogService).toSelf().inSingletonScope();

    bind(WorkflowBuilderAgent).toSelf().inSingletonScope();
    bind(Agent).toService(WorkflowBuilderAgent);
    bind(ChatAgent).toService(WorkflowBuilderAgent);

    bindToolProvider(GetNodeDocumentationTool, bind);
    bindToolProvider(CreateWorkflowTool, bind);
});
