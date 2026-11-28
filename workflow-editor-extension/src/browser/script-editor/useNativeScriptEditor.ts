import React from 'react';
import { KotlinScriptContext } from '../../common/script-editor/KotlinScriptContext';
import { ScriptEditorServices } from './ScriptEditorServicesStore';
import { NativeScriptSession, startNativeScriptSession } from './NativeScriptSession';

export interface NativeScriptEditorOptions {
  services: ScriptEditorServices | undefined;
  context: KotlinScriptContext | undefined;
  value: string;
  theme: string;
  onUserTextChange: (text: string) => void;
  /** The editor could not be created (the files could not be written, or no workspace folder is open any more). */
  onUnavailable: () => void;
}

/**
 * The lifecycle of one native script editor: starts it on the host element when the component mounts, applies value
 * changes that came from outside, and disposes it (editor first, then the temp files) on unmount.
 */
export function useNativeScriptEditor(host: React.RefObject<HTMLDivElement>, options: NativeScriptEditorOptions): void {
  const { services, context, value, theme, onUserTextChange, onUnavailable } = options;
  const session = React.useRef<NativeScriptSession | undefined>(undefined);
  // Latest callbacks and value without restarting the editor when they change.
  const latest = React.useRef({ value, onUserTextChange, onUnavailable });
  latest.current = { value, onUserTextChange, onUnavailable };

  React.useEffect(() => {
    const element = host.current;
    if (!element || !services) {
      return undefined;
    }
    let cancelled = false;
    let started: NativeScriptSession | undefined;
    startNativeScriptSession({
      services,
      host: element,
      context,
      value: latest.current.value,
      theme,
      onUserTextChange: text => latest.current.onUserTextChange(text)
    }).then(
      result => {
        if (!result) {
          latest.current.onUnavailable();
        } else if (cancelled) {
          void result.dispose();
        } else {
          started = result;
          session.current = result;
          result.setUserText(latest.current.value);
        }
      },
      error => {
        console.warn('The script editor could not start; falling back to the plain editor.', error);
        if (!cancelled) {
          latest.current.onUnavailable();
        }
      }
    );
    return () => {
      cancelled = true;
      session.current = undefined;
      if (started) {
        void started.dispose();
      }
    };
    // The editor is created once per context; value, theme and callbacks are read through `latest`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, context]);

  React.useEffect(() => {
    session.current?.setUserText(value);
  }, [value]);
}
