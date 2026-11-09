export const MAX_CONTEXT_CHARS = 16_000;

export const NO_ACTIVE_FILE = 'No file is open in the editor.';

export interface ActiveFile {
    /** Workspace-relative path shown to the model. */
    path: string;
    content?: string;
    selectedText?: string;
    /** Set when the content could not be read. */
    error?: string;
}

interface SpecLike {
    name?: string;
    nodes: { key: string; nodeId?: string; properties?: { [key: string]: any } }[];
    edges: { from: string; fromPort?: string; to: string; toPort?: string }[];
}

/**
 * Reduces a .cwf file to the compact spec format buildContinuumWorkflow takes, dropping icons, schemas and layout.
 * Returns undefined when the text is not a workflow.
 */
export function summarizeWorkflow(text: string): SpecLike | undefined {
    let workflow: any;
    try {
        workflow = JSON.parse(text);
    } catch {
        return undefined;
    }
    if (!workflow || !Array.isArray(workflow.nodes)) return undefined;
    return {
        name: workflow.name,
        nodes: workflow.nodes.map((n: any) => ({ key: n.id, nodeId: n.data?.id ?? n.data?.nodeModel, properties: n.data?.properties })),
        edges: (Array.isArray(workflow.edges) ? workflow.edges : [])
            .map((e: any) => ({ from: e.source, fromPort: e.sourceHandle, to: e.target, toPort: e.targetHandle }))
    };
}

function truncate(text: string): { text: string; truncated: boolean } {
    return text.length > MAX_CONTEXT_CHARS
        ? { text: text.slice(0, MAX_CONTEXT_CHARS), truncated: true }
        : { text, truncated: false };
}

/** Wraps text in a code fence longer than any backtick run inside it. */
function fenced(text: string, lang = ''): string {
    const longest = Math.max(2, ...(text.match(/`+/g) ?? []).map(run => run.length));
    const fence = '`'.repeat(longest + 1);
    return `${fence}${lang}\n${text}\n${fence}`;
}

export function formatActiveFile(file: ActiveFile | undefined): string {
    if (!file) return NO_ACTIVE_FILE;
    const parts = [`File: ${file.path}`];
    if (file.error) {
        parts.push(`The content could not be read: ${file.error}`);
        return parts.join('\n\n');
    }
    if (file.selectedText) {
        const selection = truncate(file.selectedText);
        parts.push(`Selected text${selection.truncated ? ` (first ${MAX_CONTEXT_CHARS} characters)` : ''}:\n${fenced(selection.text)}`);
    }
    if (file.content !== undefined) {
        const workflow = file.path.endsWith('.cwf') ? summarizeWorkflow(file.content) : undefined;
        if (workflow) {
            const summary = truncate(JSON.stringify(workflow, null, 1));
            parts.push(`This is a Continuum workflow, shown in the buildContinuumWorkflow spec format with all its property values` +
                `${summary.truncated ? ` (first ${MAX_CONTEXT_CHARS} characters)` : ''}:\n${fenced(summary.text, 'json')}`);
        } else {
            const content = truncate(file.content);
            parts.push(`Content${content.truncated ? ` (first ${MAX_CONTEXT_CHARS} of ${file.content.length} characters)` : ''}:\n${fenced(content.text)}`);
        }
    }
    return parts.join('\n\n');
}
