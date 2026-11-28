import React from 'react';
import { KotlinScriptContext } from '../../common/script-editor/KotlinScriptContext';
import { useMUIThemeStore } from '../store/MUIThemeStore';
import { useScriptEditorServices } from './ScriptEditorServicesStore';
import { useNativeScriptEditor } from './useNativeScriptEditor';

export interface NativeScriptEditorProps {
  value: string;
  context: KotlinScriptContext | undefined;
  height: string;
  onChange: (value: string) => void;
  onUnavailable: () => void;
}

/**
 * A script editor backed by a temp file in the workspace, so the Kotlin extension serves it. It reports exactly the text
 * the user typed (never the hidden wrapper) and never blocks the dialog while the language server starts.
 */
export const NativeScriptEditor: React.FC<NativeScriptEditorProps> = ({ value, context, height, onChange, onUnavailable }) => {
  const host = React.useRef<HTMLDivElement>(null);
  const services = useScriptEditorServices(state => state.services);
  const theme = useMUIThemeStore(state => state.monacoTheme);

  useNativeScriptEditor(host, { services, context, value, theme, onUserTextChange: onChange, onUnavailable });

  // `nokey`: React Flow listens for keys on `document` (Space = pan, Backspace = delete selection) unless the target is
  // inside `.nokey`.
  return <div ref={host} className="nokey" data-testid="script-editor-native" style={{ height, width: '100%' }} />;
};
