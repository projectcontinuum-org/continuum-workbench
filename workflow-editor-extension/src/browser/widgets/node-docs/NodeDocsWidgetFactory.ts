import { MaybePromise, URI } from "@theia/core";
import { Widget, WidgetFactory } from "@theia/core/lib/browser";
import { injectable } from "@theia/core/shared/inversify";
import NodeDocsWidget, { NodeDocsWidgetOptions } from "./NodeDocsWidget";

@injectable()
export default class NodeDocsWidgetFactory implements WidgetFactory {

    static createID(uri: URI, counter?: number): string {
        return NodeDocsWidget.ID
            + `:${uri.toString()}`
            + (counter !== undefined ? `:${counter}` : '');
    }

    id: string = NodeDocsWidget.ID;

    openedWidgets: { [id: string]: NodeDocsWidget | undefined } = {};

    createWidget(options: NodeDocsWidgetOptions): MaybePromise<Widget> {
        const key = options.uri.toString();
        if (this.openedWidgets[key] === undefined) {
            const widget = new NodeDocsWidget(options);
            widget.onDidDispose(() => {
                this.openedWidgets[key] = undefined;
            });
            this.openedWidgets[key] = widget;
            return widget;
        }
        return this.openedWidgets[key]!;
    }
}
