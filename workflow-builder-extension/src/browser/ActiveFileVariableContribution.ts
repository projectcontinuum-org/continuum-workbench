import { inject, injectable } from '@theia/core/shared/inversify';
import URI from '@theia/core/lib/common/uri';
import { ApplicationShell, NavigatableWidget, Saveable, Widget } from '@theia/core/lib/browser';
import { EditorWidget } from '@theia/editor/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import {
    AIVariable, AIVariableContext, AIVariableContribution, AIVariableResolutionRequest, AIVariableResolver, AIVariableService, ResolvedAIVariable
} from '@theia/ai-core/lib/common';
import { ActiveFile, formatActiveFile, MAX_CONTEXT_CHARS } from '../common/ActiveFileContext';

export const ACTIVE_FILE_VARIABLE: AIVariable = {
    id: 'continuum-active-file',
    name: 'continuumActiveFile',
    description: 'The file open in the main editor area: its path, the selected text, and its content (a .cwf workflow is summarized ' +
        'as a compact spec). Unlike currentFileContent, this also works for files open in the Continuum workflow editor.'
};

/** Larger files are not read; the model only gets their path. */
const MAX_READ_BYTES = 1_000_000;

@injectable()
export class ActiveFileVariableContribution implements AIVariableContribution, AIVariableResolver {
    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    @inject(FileService)
    protected readonly fileService: FileService;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    registerVariables(service: AIVariableService): void {
        service.registerResolver(ACTIVE_FILE_VARIABLE, this);
    }

    canResolve(request: AIVariableResolutionRequest, _context: AIVariableContext): number {
        return request.variable.name === ACTIVE_FILE_VARIABLE.name ? 1 : 0;
    }

    async resolve(request: AIVariableResolutionRequest, _context: AIVariableContext): Promise<ResolvedAIVariable | undefined> {
        if (request.variable.name !== ACTIVE_FILE_VARIABLE.name) return undefined;
        // The chat view sits in a side panel, so the main area's current widget is the editor the user last worked in.
        const file = await this.readActiveFile(this.shell.getCurrentWidget('main'));
        return { variable: request.variable, value: formatActiveFile(file) };
    }

    protected async readActiveFile(widget: Widget | undefined): Promise<ActiveFile | undefined> {
        const uri = NavigatableWidget.getUri(widget);
        if (!widget || !uri) return undefined;
        const path = this.workspaceService.getRootPrefixedPath(uri);

        if (widget instanceof EditorWidget) {
            const editor = widget.editor;
            const range = editor.selection;
            const hasSelection = range.start.line !== range.end.line || range.start.character !== range.end.character;
            return {
                path,
                content: editor.document.getText(),
                selectedText: hasSelection ? editor.document.getText(range) : undefined
            };
        }

        // Custom editors such as the workflow editor: use the unsaved state when there is one, else the file on disk.
        const saveable = Saveable.get(widget);
        const snapshot = saveable?.dirty ? saveable.createSnapshot?.() : undefined;
        const unsaved = snapshot ? Saveable.Snapshot.read(snapshot) : undefined;
        if (unsaved !== undefined) return { path, content: unsaved };
        return this.readFromDisk(uri, path);
    }

    protected async readFromDisk(uri: URI, path: string): Promise<ActiveFile> {
        try {
            const stat = await this.fileService.resolve(uri, { resolveMetadata: true });
            if (stat.size !== undefined && stat.size > MAX_READ_BYTES) {
                return { path, error: `the file is ${stat.size} bytes, more than the ${MAX_READ_BYTES} bytes this context reads (it shows at most ${MAX_CONTEXT_CHARS} characters)` };
            }
            const { value } = await this.fileService.read(uri);
            return { path, content: value };
        } catch (e) {
            return { path, error: e instanceof Error ? e.message : String(e) };
        }
    }
}
