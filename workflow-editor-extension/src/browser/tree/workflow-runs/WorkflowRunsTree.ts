import { TreeImpl, CompositeTreeNode, TreeNode } from '@theia/core/lib/browser/tree';
import { ExpandableTreeNode } from '@theia/core/lib/browser/tree/tree-expansion';
import { SelectableTreeNode } from '@theia/core/lib/browser/tree/tree-selection';
import { injectable, inject } from '@theia/core/shared/inversify';
import { IWorkflowRunItem } from '@continuum/core';
import WorkflowRunsService from '../../service/WorkflowRunsService';

/**
 * Folder node representing a directory in the workflow URI path.
 * Children are pre-populated (no API call needed to expand).
 */
export interface FolderNode extends ExpandableTreeNode, SelectableTreeNode {
    nodeType: 'folder';
}

export namespace FolderNode {
    export function is(node: TreeNode | undefined): node is FolderNode {
        return !!node && 'nodeType' in node && (node as FolderNode).nodeType === 'folder';
    }
}

/**
 * Workflow node representing a distinct workflow file (by URI).
 * Expandable — children are run instances loaded lazily from API.
 */
export interface WorkflowNode extends ExpandableTreeNode, SelectableTreeNode {
    nodeType: 'workflow';
    workflowUri: string;
}

export namespace WorkflowNode {
    export function is(node: TreeNode | undefined): node is WorkflowNode {
        return !!node && 'nodeType' in node && (node as WorkflowNode).nodeType === 'workflow';
    }
}

/**
 * Child node representing a single workflow run instance
 */
export interface WorkflowRunNode extends SelectableTreeNode {
    nodeType: 'run';
    runData: IWorkflowRunItem;
}

export namespace WorkflowRunNode {
    export function is(node: TreeNode | undefined): node is WorkflowRunNode {
        return !!node && 'nodeType' in node && (node as WorkflowRunNode).nodeType === 'run';
    }
}

/**
 * "Load more..." placeholder node for pagination
 */
export interface LoadMoreNode extends SelectableTreeNode {
    nodeType: 'load-more';
    parentNodeId: string;
    nextPage: number;
    pageSize: number;
    loadType: 'workflows' | 'runs';
    workflowUri?: string;
}

export namespace LoadMoreNode {
    export function is(node: TreeNode | undefined): node is LoadMoreNode {
        return !!node && 'nodeType' in node && (node as LoadMoreNode).nodeType === 'load-more';
    }
}

/**
 * Invisible root node
 */
export interface WorkflowRunsRootNode extends CompositeTreeNode {
    nodeType: 'root';
}

export namespace WorkflowRunsRootNode {
    export function is(node: TreeNode | undefined): node is WorkflowRunsRootNode {
        return !!node && 'nodeType' in node && (node as WorkflowRunsRootNode).nodeType === 'root';
    }

    export function create(): WorkflowRunsRootNode {
        return {
            id: 'workflow-runs-root',
            name: 'Workflow Runs',
            nodeType: 'root',
            visible: false,
            children: [],
            parent: undefined
        };
    }
}

/**
 * Internal trie structure for building the folder hierarchy
 */
interface PathTrieNode {
    segment: string;
    children: Map<string, PathTrieNode>;
    /** If this trie node represents a workflow file, its full URI */
    workflowUri?: string;
}

/**
 * Tree data provider for Workflow Runs.
 * Builds a folder hierarchy from flat workflow URIs and
 * lazily loads run instances per workflow.
 */
@injectable()
export class WorkflowRunsTree extends TreeImpl {

    @inject(WorkflowRunsService)
    protected readonly workflowRunsService!: WorkflowRunsService;

    /** RSQL time filter fragment, set by the widget toolbar */
    public timeFilter: string | undefined;

    /** Page size for API calls, controlled by toolbar dropdown */
    public pageSize: number = 50;

    protected override async resolveChildren(parent: CompositeTreeNode): Promise<TreeNode[]> {
        if (WorkflowRunsRootNode.is(parent)) {
            (parent as any).loading = true;
            this.fireChanged();
            try {
                return await this.loadWorkflowTree(parent, 0);
            } finally {
                (parent as any).loading = false;
            }
        }
        // Folder nodes already have children populated — just return them
        if (FolderNode.is(parent)) {
            return [...parent.children];
        }
        if (WorkflowNode.is(parent)) {
            (parent as any).loading = true;
            this.fireChanged();
            try {
                return await this.loadRuns(parent, 0);
            } finally {
                (parent as any).loading = false;
            }
        }
        return [];
    }

    /**
     * Load distinct workflow URIs and build a folder tree structure.
     * Folders are client-side groupings; only workflow nodes trigger API calls.
     */
    async loadWorkflowTree(root: CompositeTreeNode, page: number): Promise<TreeNode[]> {
        try {
            const result = await this.workflowRunsService.getDistinctWorkflows(
                this.timeFilter, page, this.pageSize
            );

            // Build a trie from all URIs to create the folder hierarchy
            const trie = this.buildPathTrie(result.content);
            const nodes: TreeNode[] = this.trieToTreeNodes(trie, root);

            if (page + 1 < result.totalPages) {
                nodes.push(this.toLoadMoreNode(root, page + 1, 'workflows'));
            }
            return nodes;
        } catch (error) {
            console.error('[WorkflowRunsTree] Failed to load workflows:', error);
            return [];
        }
    }

    /**
     * Load a page of runs for a specific workflow URI
     */
    async loadRuns(parent: WorkflowNode, page: number): Promise<TreeNode[]> {
        try {
            const result = await this.workflowRunsService.getRunsByWorkflowUri(
                parent.workflowUri, this.timeFilter, page, this.pageSize
            );
            const nodes: TreeNode[] = result.content.map(run => this.toRunNode(run, parent));

            if (page + 1 < result.totalPages) {
                nodes.push(this.toLoadMoreNode(parent, page + 1, 'runs', parent.workflowUri));
            }
            return nodes;
        } catch (error) {
            console.error('[WorkflowRunsTree] Failed to load runs for:', parent.workflowUri, error);
            return [];
        }
    }

    /**
     * Handle "Load more" click — append next page to parent's children.
     * For 'workflows', new URIs are merged into the existing folder tree.
     */
    async loadMore(loadMoreNode: LoadMoreNode): Promise<void> {
        const parent = loadMoreNode.parent;
        if (!parent || !CompositeTreeNode.is(parent)) return;

        if (loadMoreNode.loadType === 'workflows' && WorkflowRunsRootNode.is(parent)) {
            const newNodes = await this.loadWorkflowTree(parent, loadMoreNode.nextPage);
            // Merge: remove old LoadMoreNode, add new nodes (which may include a new LoadMoreNode)
            const existing = parent.children.filter(c => c.id !== loadMoreNode.id);
            const merged = this.mergeFolderChildren(existing, newNodes, parent);
            (parent as any).children = merged;
            this.fireChanged();
        } else if (loadMoreNode.loadType === 'runs' && WorkflowNode.is(parent)) {
            const newNodes = await this.loadRuns(parent, loadMoreNode.nextPage);
            const children = [...parent.children.filter(c => c.id !== loadMoreNode.id), ...newNodes];
            (parent as any).children = children;
            for (const child of newNodes) {
                (child as any).parent = parent;
            }
            this.fireChanged();
        }
    }

    /**
     * Merge new folder/workflow nodes into existing children.
     * If a folder already exists, merge its children recursively.
     */
    protected mergeFolderChildren(
        existing: readonly TreeNode[],
        incoming: TreeNode[],
        parent: CompositeTreeNode
    ): TreeNode[] {
        const result = [...existing];
        const existingMap = new Map<string, TreeNode>();
        for (const node of existing) {
            existingMap.set(node.id, node);
        }

        for (const node of incoming) {
            const existingNode = existingMap.get(node.id);
            if (existingNode && FolderNode.is(existingNode) && FolderNode.is(node)) {
                // Merge folder children recursively
                const merged = this.mergeFolderChildren(
                    existingNode.children, [...node.children], existingNode
                );
                (existingNode as any).children = merged;
            } else if (!existingMap.has(node.id)) {
                (node as any).parent = parent;
                result.push(node);
            }
        }
        return result;
    }

    /**
     * Build a path trie from a list of workflow URIs.
     * Each URI is split into path segments; the leaf holds the full URI.
     */
    protected buildPathTrie(uris: string[]): PathTrieNode {
        const root: PathTrieNode = { segment: '', children: new Map() };

        for (const uri of uris) {
            const segments = this.extractPathSegments(uri);
            let current = root;
            for (let i = 0; i < segments.length; i++) {
                const seg = segments[i];
                if (!current.children.has(seg)) {
                    current.children.set(seg, { segment: seg, children: new Map() });
                }
                current = current.children.get(seg)!;
                // Last segment = the workflow file itself
                if (i === segments.length - 1) {
                    current.workflowUri = uri;
                }
            }
        }
        return root;
    }

    /**
     * Convert a path trie into Theia TreeNodes.
     * Collapses single-child folder chains (e.g., "a/b/c" with no siblings
     * becomes a single folder node labeled "a/b/c").
     */
    protected trieToTreeNodes(trie: PathTrieNode, parent: CompositeTreeNode): TreeNode[] {
        const nodes: TreeNode[] = [];

        for (const [, child] of trie.children) {
            const node = this.trieNodeToTreeNode(child, parent, '');
            nodes.push(node);
        }

        return nodes;
    }

    protected trieNodeToTreeNode(
        trieNode: PathTrieNode,
        parent: CompositeTreeNode,
        pathPrefix: string
    ): TreeNode {
        const fullPath = pathPrefix ? `${pathPrefix}/${trieNode.segment}` : trieNode.segment;

        // If this is a workflow leaf (has a URI), create a WorkflowNode
        if (trieNode.workflowUri) {
            // It could also have folder children if there are files AND subfolders
            // at the same level, but typically a workflow URI is a leaf.
            if (trieNode.children.size === 0) {
                return this.toWorkflowNode(trieNode.workflowUri, trieNode.segment, parent);
            }
            // Rare case: a URI that is also a prefix of other URIs
            // Show it as a workflow node (children loaded lazily as runs)
            return this.toWorkflowNode(trieNode.workflowUri, trieNode.segment, parent);
        }

        // Collapse single-child folder chains:
        // If this folder has exactly one child that is also a folder (not a workflow),
        // merge them into a single label like "project/subfolder"
        if (trieNode.children.size === 1) {
            const [, onlyChild] = [...trieNode.children.entries()][0];
            if (!onlyChild.workflowUri || onlyChild.children.size > 0) {
                // Collapse: pass the accumulated path prefix forward
                return this.trieNodeToTreeNode(onlyChild, parent, fullPath);
            }
        }

        // Create a folder node with pre-populated children
        const folderNode: FolderNode = {
            id: `folder:${fullPath}`,
            name: fullPath,
            parent,
            visible: true,
            nodeType: 'folder',
            expanded: false,
            selected: false,
            children: []
        };

        // Recursively build child nodes
        const children: TreeNode[] = [];
        for (const [, child] of trieNode.children) {
            children.push(this.trieNodeToTreeNode(child, folderNode, ''));
        }
        (folderNode as any).children = children;

        return folderNode;
    }

    protected toWorkflowNode(uri: string, displayName: string, parent: CompositeTreeNode): WorkflowNode {
        // Remove file extension from display name
        const name = displayName.replace(/\.[^.]+$/, '');
        return {
            id: `workflow:${uri}`,
            name,
            parent,
            visible: true,
            nodeType: 'workflow',
            workflowUri: uri,
            expanded: false,
            selected: false,
            children: []
        };
    }

    protected toRunNode(run: IWorkflowRunItem, parent: WorkflowNode): WorkflowRunNode {
        const dateLabel = this.formatDateTime(run.updatedAt || run.createdAt);
        return {
            id: `run:${run.workflowId}`,
            name: dateLabel,
            parent,
            visible: true,
            nodeType: 'run',
            selected: false,
            runData: run
        };
    }

    protected toLoadMoreNode(
        parent: CompositeTreeNode,
        nextPage: number,
        loadType: 'workflows' | 'runs',
        workflowUri?: string
    ): LoadMoreNode {
        return {
            id: `load-more:${parent.id}:${nextPage}`,
            name: 'Load more...',
            parent,
            visible: true,
            nodeType: 'load-more',
            selected: false,
            parentNodeId: parent.id,
            nextPage,
            pageSize: this.pageSize,
            loadType,
            workflowUri
        };
    }

    /**
     * Extract path segments from a workflow URI.
     * Handles both full URLs (s3://bucket/path/file.json) and plain paths.
     */
    protected extractPathSegments(uri: string): string[] {
        try {
            const url = new URL(uri);
            // For URLs like s3://bucket/project/workflow.json
            // Include the scheme+host as the first segment for clarity
            const pathSegments = url.pathname.split('/').filter(s => s.length > 0);
            const host = url.host || url.protocol.replace(':', '');
            return [host, ...pathSegments];
        } catch {
            // Plain path like "project/subfolder/workflow.json"
            return uri.split('/').filter(s => s.length > 0);
        }
    }

    protected formatDateTime(isoString: string): string {
        try {
            const date = new Date(isoString);
            return date.toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch {
            return isoString;
        }
    }
}
