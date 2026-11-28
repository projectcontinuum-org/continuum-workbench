import React from 'react';
import { FormHelperText } from '@mui/material';

/** Shown under a plain script editor when code intelligence is off only because the workspace is not trusted. */
export const WorkspaceTrustNote: React.FC = () => (
  <FormHelperText role="note" data-testid="script-editor-trust-note" sx={{ mt: 1 }}>
    Trust this workspace to enable code intelligence
  </FormHelperText>
);
