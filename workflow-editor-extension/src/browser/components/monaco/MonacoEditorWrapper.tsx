import React, { useEffect, useRef } from 'react';
import { useMUIThemeStore } from '../../store/MUIThemeStore';

export interface MonacoEditorWrapperProps {
    value: string;
    language: string;
    theme?: string;
    height?: string;
    options?: any;
    onChange?: (value: string) => void;
}

export const MonacoEditorWrapper: React.FC<MonacoEditorWrapperProps> = ({
    value,
    language,
    theme,
    height,
    options,
    onChange
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<any | null>(null);

    // Get Theia's Monaco instance from the store
    const monaco = useMUIThemeStore((state) => state.monaco);

    // Create editor on mount
    useEffect(() => {
        const container = containerRef.current;
        if (!container || !monaco) return;

        const editor = monaco.editor.create(container, {
            value: value,
            language: language,
            theme: theme || 'vs-dark',
            'semanticHighlighting.enabled': false,
            // Theia's Monaco (1.108) defaults to the native EditContext API, whose input
            // element is a plain `div.native-edit-context`. Page-level key handlers (React
            // Flow) don't recognise it as a text field, and macOS text services (e.g.
            // "add period with double-space") act on it inconsistently. The classic hidden
            // `textarea.inputarea` is treated as a normal input everywhere.
            editContext: false,
            // Don't let a typed character such as Space accept a suggestion.
            acceptSuggestionOnCommitCharacter: false,
            ...options
        });

        editorRef.current = editor;

        // Keep editor key events from reaching document-level listeners (React Flow's
        // Space = pan and Backspace = delete). Bubble phase and no preventDefault(),
        // so Monaco, which handles keys on its input element, still gets every key first.
        const stopKey = (e: KeyboardEvent) => e.stopPropagation();
        container.addEventListener('keydown', stopKey);
        container.addEventListener('keyup', stopKey);

        // Listen to content changes
        const disposable = editor.onDidChangeModelContent(() => {
            onChange?.(editor.getValue());
        });

        // Cleanup on unmount
        return () => {
            container.removeEventListener('keydown', stopKey);
            container.removeEventListener('keyup', stopKey);
            disposable.dispose();
            editor.dispose();
            editorRef.current = null;
        };
    }, [monaco]);

    // Sync external value changes
    useEffect(() => {
        if (!editorRef.current) return;

        const currentValue = editorRef.current.getValue();
        if (currentValue !== value) {
            editorRef.current.setValue(value);
        }
    }, [value]);

    // Update theme when changed
    useEffect(() => {
        if (!monaco || !theme || !editorRef.current) return;

        monaco.editor.setTheme(theme);
        editorRef.current.updateOptions({ theme });
    }, [monaco, theme]);

    // Update options when changed
    useEffect(() => {
        if (!editorRef.current || !options) return;
        editorRef.current.updateOptions(options);
    }, [options]);

    // `nokey`: React Flow listens for keys on `document` (Space = pan activation,
    // Backspace = delete selection) and calls preventDefault() unless the target is
    // an input/textarea/contenteditable or inside `.nokey`. Monaco's native
    // EditContext input is a plain <div>, so without this the editor never receives
    // Space and Backspace would delete selected workflow nodes.
    return (
        <div
            ref={containerRef}
            className="nokey"
            style={{
                height: height || '400px',
                width: '100%'
            }}
        />
    );
};
