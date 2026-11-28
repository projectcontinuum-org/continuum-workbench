import React from 'react';
import { FormHelperText } from '@mui/material';

/** Shown under a plain script editor when code intelligence is off only because no workspace folder is open. */
export const WorkspaceRequiredNote: React.FC = () => (
  <FormHelperText role="note" data-testid="script-editor-workspace-note" sx={{ mt: 1 }}>
    Open a folder to enable code intelligence
  </FormHelperText>
);
