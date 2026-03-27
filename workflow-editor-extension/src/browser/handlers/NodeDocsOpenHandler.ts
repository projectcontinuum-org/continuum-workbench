import { WidgetOpenerOptions, WidgetOpenHandler } from "@theia/core/lib/browser";
import NodeDocsWidget from "../widgets/node-docs/NodeDocsWidget";
import { MaybePromise, URI } from "@theia/core";

export default class NodeDocsOpenHandler extends WidgetOpenHandler<NodeDocsWidget> {
    id: string = NodeDocsWidget.ID;

    label?: string = "Node Documentation";

    iconClass?: string = "fa fa-book";

    canHandle(uri: URI, options?: WidgetOpenerOptions): MaybePromise<number> {
        return uri.scheme === "continuum-node-docs" ? 1000 : -1;
    }

    protected createWidgetOptions(uri: URI, options?: WidgetOpenerOptions) {
        const nodeId = uri.authority || uri.path.toString().replace(/^\//, '');
        return {
            uri,
            nodeId,
            ...options
        };
    }

    protected async doOpen(widget: NodeDocsWidget, options?: WidgetOpenerOptions): Promise<void> {
        return super.doOpen(widget, {
            ...options,
            widgetOptions: options?.widgetOptions ?? { area: 'bottom' }
        });
    }
}
