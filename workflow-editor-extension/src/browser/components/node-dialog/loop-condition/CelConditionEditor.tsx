/**
 * CEL mode editor — a Monaco-based code editor for writing loop conditions as raw CEL.
 * Reuses the existing MonacoEditorWrapper from CodeEditorRenderer.
 */

import * as React from 'react';
import { Box, FormHelperText, Typography } from '@mui/material';
import { useMUIThemeStore } from '../../../store/MUIThemeStore';
import { MonacoEditorWrapper } from '../../monaco/MonacoEditorWrapper';

interface CelConditionEditorProps {
    value: string;
    onChange: (value: string) => void;
    validationIssues: Array<{ message: string; column?: number }>;
    ariaLabel?: string;
}

export function CelConditionEditor({ value, onChange, validationIssues, ariaLabel = 'Loop condition in CEL text' }: CelConditionEditorProps) {
    const monacoTheme = useMUIThemeStore((state: { monacoTheme: string }) => state.monacoTheme);

    return (
        <Box sx={{ width: '100%', mb: 2 }} aria-label={ariaLabel}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Condition (CEL)
            </Typography>
            <Box
                sx={{
                    border: validationIssues.length > 0 ? `1px solid ${'#c62828'}` : `1px solid`,
                    borderRadius: '4px',
                    overflow: 'hidden',
                }}
            >
                <MonacoEditorWrapper
                    value={value}
                    language="javascript"
                    height={`${120}px`}
                    theme={monacoTheme}
                    aria-label={ariaLabel}
                    options={{
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        formatOnPaste: true,
                        formatOnType: true,
                        automaticLayout: true,
                    }}
                    onChange={(newValue?: string) => {
                        if (newValue !== undefined) onChange(newValue);
                    }}
                />
            </Box>
            {validationIssues.map((issue, i) => (
                <FormHelperText key={i} error sx={{ mt: 0.5 }}>
                    {issue.message}
                </FormHelperText>
            ))}
        </Box>
    );
}
