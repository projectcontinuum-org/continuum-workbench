import React, { ReactNode } from "react";
import { Message, ReactWidget } from "@theia/core/lib/browser";
import { URI } from "@theia/core";
import { Emitter, Event } from "@theia/core/lib/common";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import NodeExplorerService from "../../service/NodeExplorerService";

export const NodeDocsWidgetOptions = Symbol('NodeDocsWidgetOptions');
export interface NodeDocsWidgetOptions {
    uri: URI;
    nodeId: string;
    preview?: boolean;
}

export default class NodeDocsWidget extends ReactWidget {
    static readonly ID = 'continuum-node-docs:widget';

    protected markdown: string = '';
    protected loading: boolean = true;
    protected error: string | undefined;
    protected nodeExplorerService = new NodeExplorerService();
    private _nodeId: string;
    private _preview: boolean;

    private readonly onDidPinEmitter = new Emitter<void>();
    readonly onDidPin: Event<void> = this.onDidPinEmitter.event;

    constructor(private options: NodeDocsWidgetOptions) {
        super();
        this._preview = options.preview ?? false;
        this._nodeId = options.nodeId;
        this.id = `${NodeDocsWidget.ID}:${this.options.uri}`;
        this.updateTitle();
    }

    get preview(): boolean {
        return this._preview;
    }

    /**
     * Pin this widget so it is no longer reused as a preview.
     */
    pin(): void {
        if (!this._preview) {
            return;
        }
        this._preview = false;
        this.updateTitle();
        this.onDidPinEmitter.fire();
    }

    /**
     * Replace the displayed node documentation (used in preview mode).
     */
    showNode(options: NodeDocsWidgetOptions): void {
        this.options = options;
        this._nodeId = options.nodeId;
        this.updateTitle();
        this.fetchDocumentation();
    }

    private updateTitle(): void {
        const nodeId = this._nodeId;
        const shortName = nodeId.includes('.') ? nodeId.substring(nodeId.lastIndexOf('.') + 1) : nodeId;
        this.title.label = `Docs: ${shortName}`;
        this.title.caption = nodeId;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-book';
        this.title.className = this._preview ? 'continuum-node-docs-preview' : '';
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.fetchDocumentation();
    }

    protected async fetchDocumentation(): Promise<void> {
        try {
            this.loading = true;
            this.error = undefined;
            this.update();

            this.markdown = await this.nodeExplorerService.getDocumentation(this.options.nodeId);
            this.loading = false;
            this.update();
        } catch (e: any) {
            this.loading = false;
            this.error = e.message || 'Failed to load documentation';
            this.update();
        }
    }

    protected render(): ReactNode {
        return <NodeDocsContent markdown={this.markdown} loading={this.loading} error={this.error} />;
    }
}

interface NodeDocsContentProps {
    markdown: string;
    loading: boolean;
    error: string | undefined;
}

function NodeDocsContent({ markdown, loading, error }: NodeDocsContentProps) {
    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--theia-foreground)' }}>
                <i className="fa fa-spinner fa-spin" style={{ marginRight: 8 }} />
                Loading documentation...
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--theia-errorForeground)' }}>
                <i className="fa fa-exclamation-triangle" style={{ marginRight: 8 }} />
                {error}
            </div>
        );
    }

    return (
        <div className="node-docs-content" style={{
            height: '100%',
            overflow: 'auto',
            padding: '16px 24px',
            color: 'var(--theia-foreground)',
            fontFamily: 'var(--theia-ui-font-family)',
            fontSize: 'var(--theia-ui-font-size1)',
            lineHeight: 1.6
        }}>
            <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
        </div>
    );
}
