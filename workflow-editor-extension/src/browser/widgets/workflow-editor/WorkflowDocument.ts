import { IWorkflow } from "@continuum/core";
import { DisposableCollection, Emitter, Event, MaybePromise, URI } from "@theia/core";
import { SaveOptions, Saveable } from "@theia/core/lib/browser";
import { RemoteFileSystemProvider } from "@theia/filesystem/lib/common/remote-file-system-provider";

export default class WorkflowDocument implements Saveable {
    protected originalWorkflow?: IWorkflow;
    protected unsavedWorkflow?: IWorkflow;
    /** The file text last loaded or saved, so a change event for that same text can be ignored. */
    syncedContent?: string;
    protected readonly toDispose = new DisposableCollection();
    protected readonly onChangeEventEmitter = new Emitter<void>();
    public readonly onContentChanged = new Emitter<void>().event;
    _dirty: boolean = false;
    onDirtyChanged: Event<void> = this.onChangeEventEmitter.event;
    autoSave: "off" | "afterDelay" | "onFocusChange" | "onWindowChange" = 'off';

    constructor(
        protected readonly remoteFileSystemProvider: RemoteFileSystemProvider,
        protected readonly resourceUri: URI
    ) {}

    setUnsavedWorkflow(wf?: IWorkflow) {
        if(JSON.stringify(this.originalWorkflow) != JSON.stringify(wf)) {
            this.unsavedWorkflow = wf;
            this.setDirty(true);
        }
    }

    /** Makes wf the saved state, as loaded from content (the file text). */
    reset(wf: IWorkflow, content: string) {
        this.originalWorkflow = wf;
        this.unsavedWorkflow = undefined;
        this.syncedContent = content;
        this.setDirty(false);
    }

    get dirty(): boolean {
        return this._dirty;
    }

    /**
     * True when there are unsaved changes beyond what React Flow sets on its own when it shows a workflow
     * (measured node sizes, selection), so a file written by another tool is not reported as edited.
     */
    hasUnsavedEdits(): boolean {
        return this.dirty && WorkflowDocument.withoutViewState(this.unsavedWorkflow) != WorkflowDocument.withoutViewState(this.originalWorkflow);
    }

    protected static withoutViewState(wf?: IWorkflow): string | undefined {
        const omit = (item: object, keys: string[]) => {
            const copy: { [key: string]: unknown } = { ...item };
            keys.forEach(key => delete copy[key]);
            return copy;
        };
        return wf && JSON.stringify({
            ...wf,
            nodes: wf.nodes.map(node => omit(node, ['width', 'height', 'selected', 'dragging', 'positionAbsolute'])),
            edges: wf.edges.map(edge => omit(edge, ['selected']))
        });
    }

    setDirty(value: boolean) {
        if(this._dirty != value) {
            this._dirty = value;
            this.onChangeEventEmitter.fire();
        }
    }

    save(options?: SaveOptions | undefined): MaybePromise<void> {
        return new Promise((resolve)=>{
            if(this.unsavedWorkflow != undefined) {
                console.log("Saving ", options, this.unsavedWorkflow);
                this.originalWorkflow = this.unsavedWorkflow;
                this.syncedContent = JSON.stringify(this.originalWorkflow, null, 4);
                const encoder = new TextEncoder();
                this.remoteFileSystemProvider.writeFile(this.resourceUri, encoder.encode(this.syncedContent), {create: true, overwrite: true});
                this.setDirty(false);
            }
            resolve();
        });
    }

    createSnapshot(): Saveable.Snapshot {
        const workflow = this.unsavedWorkflow ?? this.originalWorkflow;
        const content = workflow ? JSON.stringify(workflow, null, 4) : '{}';
        return { value: content };
    }

    async revert(options?: Saveable.RevertOptions | undefined): Promise<void> {
        if (!options?.soft) {
            this.unsavedWorkflow = undefined;
        }
        this.setDirty(false);
    }
}