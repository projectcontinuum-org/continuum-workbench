import React from 'react';
import { ControlProps } from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { Box, FormHelperText, Typography, useTheme } from '@mui/material';
import { MonacoEditorWrapper } from '../monaco/MonacoEditorWrapper';
import { isControl, rankWith } from '@jsonforms/core';
import { useMUIThemeStore } from '../../store/MUIThemeStore';

import { resolveCodeEditorOptions } from '../../../common/CodeEditorOptions';
import { parseKotlinScriptContext } from '../../../common/script-editor/KotlinScriptContext';
import { decideScriptEditorRoute } from '../../../common/script-editor/ScriptEditorRoute';
import { NativeScriptEditor } from '../../script-editor/NativeScriptEditor';
import { useWorkspaceRoot } from '../../script-editor/useWorkspaceRoot';
import { useWorkspaceTrust } from '../../script-editor/useWorkspaceTrust';
import { WorkspaceRequiredNote } from '../../script-editor/WorkspaceRequiredNote';
import { WorkspaceTrustNote } from '../../script-editor/WorkspaceTrustNote';

const CodeEditorRenderer: React.FC<ControlProps> = (props) => {
  const {
    data,
    handleChange,
    label,
    errors,
    visible,
  } = props;
  // JSONForms passes the UI schema's options through the UI schema, not as a prop of its own.
  const { declaredLanguage, monacoLanguage: language, rows, format, scriptContext } = resolveCodeEditorOptions(props.uischema);

  const muiTheme = useTheme();
  const monacoTheme = useMUIThemeStore((state) => state.monacoTheme);

  // The names the node reported for this script, if usable. They only add to what the editor with code intelligence
  // knows: without them (none, or malformed) a Kotlin editor still gets the standard library and Java.
  // Keyed by content: a UI schema rebuilt with equal content must not restart the editor.
  const contextKey = JSON.stringify(scriptContext ?? null);
  const context = React.useMemo(() => parseKotlinScriptContext(scriptContext), [contextKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const workspaceRoot = useWorkspaceRoot();
  const trusted = useWorkspaceTrust();
  const [nativeUnavailable, setNativeUnavailable] = React.useState(false);
  const route = decideScriptEditorRoute({ language: declaredLanguage, hasWorkspaceRoot: workspaceRoot !== undefined, trusted: trusted !== false });
  const useNative = route.kind === 'native' && !nativeUnavailable;

  const [value, setValue] = React.useState<string>(data || '');

  // Sync local state with prop changes
  React.useEffect(() => {
    setValue(data || '');
  }, [data]);

  const handleEditorChange = (newValue: string | undefined) => {
    if (newValue !== undefined) {
      setValue(newValue);
      handleChange(props.path, newValue);
    }
  };

  // Calculate dynamic height based on content or use rows option
  const lineCount = value ? value.split('\n').length : 1;
  const dynamicRows = Math.max(Math.min(lineCount, rows), 1);
  const editorHeight = `${dynamicRows * 20}px`;
  const hasError = errors && errors.length > 0;
  const errorMessage = errors && errors.length > 0 ? errors[0] : undefined;

  if (format !== 'code') {
    return null;
  }

  if (visible === false) {
    return null;
  }

  return (
    <Box sx={{ width: '100%', mb: 2 }}>
      {label && (
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          {label}
        </Typography>
      )}
      <Box
        sx={{
          border: hasError ? `1px solid ${muiTheme.palette.error.main}` : `1px solid ${muiTheme.palette.divider}`,
          borderRadius: '4px',
          overflow: 'hidden',
          background: muiTheme.palette.background.default,
        }}
      >
        {useNative ? (
          <NativeScriptEditor
            value={value}
            context={context}
            height={editorHeight}
            onChange={(text) => handleEditorChange(text)}
            onUnavailable={() => setNativeUnavailable(true)}
          />
        ) : (
          <MonacoEditorWrapper
            value={value}
            language={language}
            height={editorHeight}
            theme={monacoTheme}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              formatOnPaste: true,
              formatOnType: true,
              automaticLayout: true
            }}
            onChange={handleEditorChange}
          />
        )}
      </Box>
      {route.kind === 'plain' && route.reason === 'no-workspace' && <WorkspaceRequiredNote />}
      {route.kind === 'plain' && route.reason === 'untrusted' && <WorkspaceTrustNote />}
      {route.kind === 'native' && nativeUnavailable && (
        <FormHelperText role="note" data-testid="script-editor-unavailable-note" sx={{ mt: 1 }}>
          Code intelligence is unavailable for this editor
        </FormHelperText>
      )}
      {errorMessage && (
        <FormHelperText error={true} sx={{ mt: 1 }}>
          {errorMessage}
        </FormHelperText>
      )}
    </Box>
  );
};

const CodeEditorControl = withJsonFormsControlProps(CodeEditorRenderer);

// Tester to determine when to use this renderer
export const codeEditorTester = rankWith(
  10,
  (uischema: any) => {
    return (
      isControl(uischema) &&
      uischema.options?.format === 'code'
    );
  }
);

export { CodeEditorControl };
export default CodeEditorControl;
