import { WidgetOpenerOptions, WidgetOpenHandler } from "@theia/core/lib/browser";
import NodeDocsWidget from "../widgets/node-docs/NodeDocsWidget";
import { MaybePromise, URI } from "@theia/core";

export interface NodeDocsOpenerOptions extends WidgetOpenerOptions {
    preview?: boolean;
}

export default class NodeDocsOpenHandler extends WidgetOpenHandler<NodeDocsWidget> {
    id: string = NodeDocsWidget.ID;

    label?: string = "Node Documentation";

    iconClass?: string = "fa fa-book";

    private previewWidget: NodeDocsWidget | undefined;
    private tabDblClickCleanup?: () => void;

    canHandle(uri: URI, _options?: WidgetOpenerOptions): MaybePromise<number> {
        return uri.scheme === "continuum-node-docs" ? 1000 : -1;
    }

    protected createWidgetOptions(uri: URI, options?: NodeDocsOpenerOptions) {
        const nodeId = uri.authority || uri.path.toString().replace(/^\//, '');
        return {
            uri,
            nodeId,
            preview: options?.preview ?? true,
            ...options
        };
    }

    async open(uri: URI, options?: NodeDocsOpenerOptions): Promise<NodeDocsWidget> {
        const isPreview = options?.preview ?? true;

        // Reuse existing preview widget if it's still alive and unpinned
        if (isPreview && this.previewWidget && !this.previewWidget.isDisposed && this.previewWidget.preview) {
            const widgetOptions = this.createWidgetOptions(uri, options);
            this.previewWidget.showNode(widgetOptions);
            await this.doOpen(this.previewWidget, options);
            return this.previewWidget;
        }

        // Create a new widget via the standard widget manager path
        const widget = await this.getOrCreateWidget(uri, options);

        if (isPreview) {
            this.trackPreviewWidget(widget);
        }

        await this.doOpen(widget, options);
        return widget;
    }

    protected async doOpen(widget: NodeDocsWidget, options?: WidgetOpenerOptions): Promise<void> {
        return super.doOpen(widget, {
            ...options,
            widgetOptions: options?.widgetOptions ?? { area: 'bottom' }
        });
    }

    private trackPreviewWidget(widget: NodeDocsWidget): void {
        this.previewWidget = widget;

        widget.onDidDispose(() => {
            if (this.previewWidget === widget) {
                this.clearPreview();
            }
        });

        widget.onDidPin(() => {
            if (this.previewWidget === widget) {
                this.clearPreview();
            }
        });

        this.setupTabDoubleClick(widget);
    }

    private clearPreview(): void {
        this.previewWidget = undefined;
        this.tabDblClickCleanup?.();
    }

    /**
     * Listen for double-click on the preview widget's tab to pin it.
     * Uses event delegation on the bottom panel so it survives tab re-renders.
     */
    private setupTabDoubleClick(widget: NodeDocsWidget): void {
        this.tabDblClickCleanup?.();

        const expectedTabId = `shell-tab-${widget.id}`;

        const handler = (event: Event) => {
            const target = event.target as HTMLElement;
            const tab = target.closest('.p-TabBar-tab');
            if (tab && tab.id === expectedTabId) {
                event.stopPropagation();
                widget.pin();
            }
        };

        const panelNode = this.shell.bottomPanel.node;
        panelNode.addEventListener('dblclick', handler, true);

        this.tabDblClickCleanup = () => {
            panelNode.removeEventListener('dblclick', handler, true);
            this.tabDblClickCleanup = undefined;
        };
    }
}
