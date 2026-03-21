import { TreeModelImpl, TreeModel } from '@theia/core/lib/browser/tree';
import { injectable } from '@theia/core/shared/inversify';

export const WorkflowRunsTreeModel = Symbol('WorkflowRunsTreeModel');
export type WorkflowRunsTreeModel = TreeModel;

@injectable()
export class WorkflowRunsTreeModelImpl extends TreeModelImpl {
}
