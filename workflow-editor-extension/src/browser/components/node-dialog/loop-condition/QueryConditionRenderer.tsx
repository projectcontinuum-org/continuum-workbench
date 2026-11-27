/**
 * JSONForms control for loop conditions with two modes:
 * - CEL text mode (always available)
 * - Visual builder mode (only when expression fits builder shape)
 */

import * as React from 'react';
import { ControlProps } from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Switch,
    Typography,
} from '@mui/material';
import { CelConditionEditor } from './CelConditionEditor';
import { LoopConditionBuilder } from './LoopConditionBuilder';
import {
    canToggleToBuilder,
    builderToggleDisabledReason,
    conditionRequiredMessage,
    initialMode,
    replaceAction,
} from '../../../../common/LoopConditionDialogState';
import { fitsBuilder } from '../../../../common/LoopConditionQuery';
import { queryConditionTester } from '../../../../common/QueryConditionTester';
import { useConditionValidation } from './useConditionValidation';

export function QueryConditionRenderer(props: ControlProps) {
    const { data, handleChange, label, errors } = props;
    const options = props.uischema.options;
    const condition = typeof data === 'string' ? data : '';
    const validation = useConditionValidation(condition);
    const [mode, setMode] = React.useState<'cel' | 'builder'>(() => initialMode(condition, fitsBuilder).initialMode);
    const [replaceDialogOpen, setReplaceDialogOpen] = React.useState(false);
    const requiredMessage = conditionRequiredMessage(condition);
    const isCelOnlyCondition = requiredMessage === null && !fitsBuilder(condition);
    const toggle = canToggleToBuilder(condition);
    const disabledReason = builderToggleDisabledReason(condition);
    const handleBuilderChange = React.useCallback((celText: string) => {
        handleChange(props.path, celText);
    }, [handleChange, props.path]);

    // Type guard — JSONForms data can be any type.
    if (options?.format !== 'query') return null;

    return (
        <Box sx={{ width: '100%', mb: 2 }}>
            {label && (
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>{label}</Typography>
            )}

            {/* Mode toggle */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="caption">CEL</Typography>
                <Switch
                    data-testid="loop-condition-mode-toggle"
                    inputProps={{ 'aria-label': 'Use visual condition builder' }}
                    checked={mode === 'builder'}
                    disabled={mode === 'cel' && toggle.disabled}
                    onChange={(e) => {
                        if (!e.target.checked) setMode('cel');
                        else if (!toggle.disabled) setMode('builder');
                    }}
                    size="small"
                />
                <Typography variant="caption">Builder</Typography>

                {mode === 'cel' && isCelOnlyCondition && (
                    <Button
                        data-testid="loop-condition-replace"
                        size="small"
                        variant="outlined"
                        onClick={() => setReplaceDialogOpen(true)}
                    >
                        Replace with a new builder condition
                    </Button>
                )}
            </Box>

            {mode === 'cel' && disabledReason && (
                <Typography
                    variant="caption"
                    color="text.secondary"
                    data-testid="loop-condition-builder-disabled-reason"
                    sx={{ display: 'block', mb: 1 }}>
                    {disabledReason}
                </Typography>
            )}
            {requiredMessage && (
                <Alert severity="error" data-testid="loop-condition-required">
                    {requiredMessage}
                </Alert>
            )}
            {mode === 'cel' && isCelOnlyCondition && (
                <Alert severity="warning" data-testid="loop-condition-cel-only-warning" sx={{ mb: 1 }}>
                    CEL-only expression. This condition uses CEL features the builder cannot show.
                </Alert>
            )}

            {/* Editor content */}
            {mode === 'cel' ? (
                <CelConditionEditor
                    value={condition}
                    onChange={(newValue) => {
                        handleChange(props.path, newValue);
                    }}
                    validationIssues={validation.issues}
                    ariaLabel="Loop condition in CEL text"
                />
            ) : (
                <LoopConditionBuilder
                    value={data}
                    onChange={handleBuilderChange}
                />
            )}

            {validation.status === 'checking' && (
                !requiredMessage && <Alert icon={<CircularProgress size={16} />} severity="info" data-testid="loop-condition-validation-status">
                    Checking condition…
                </Alert>
            )}
            {!requiredMessage && validation.status === 'checked' && (
                <Alert severity="success" data-testid="loop-condition-validation-status">
                    Condition is valid.
                </Alert>
            )}
            {!requiredMessage && validation.status === 'not-checked' && (
                <Alert severity="info" data-testid="loop-condition-validation-status">
                    Condition not checked. The validation service may be unavailable.
                </Alert>
            )}
            {mode === 'builder' && validation.issues.map((issue, index) => (
                <Alert key={`${issue.node}-${index}`} severity="error" data-testid="loop-condition-validation-issue">
                    {issue.message}
                </Alert>
            ))}

            {errors && errors.length > 0 && (
                <Typography variant="caption" color="error">{errors[0]}</Typography>
            )}
            <Dialog open={replaceDialogOpen} onClose={() => setReplaceDialogOpen(false)}>
                <DialogTitle>Replace this CEL condition?</DialogTitle>
                <DialogContent>
                    <Typography>
                        The current expression will be replaced with a new builder condition. This cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button
                        data-testid="loop-condition-replace-cancel"
                        onClick={() => setReplaceDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        data-testid="loop-condition-replace-confirm"
                        color="warning"
                        onClick={() => {
                            const replacement = replaceAction();
                            setMode(replacement.mode);
                            handleChange(props.path, replacement.newText);
                            setReplaceDialogOpen(false);
                        }}>
                        Replace condition
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export { queryConditionTester };
export default withJsonFormsControlProps(QueryConditionRenderer);
