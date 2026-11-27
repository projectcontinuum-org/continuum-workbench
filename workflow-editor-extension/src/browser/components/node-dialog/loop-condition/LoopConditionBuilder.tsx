/**
 * React Query Builder component for loop conditions.
 * This is the only component in the product that imports react-querybuilder — tree-shakeability requires a single import point.
 */

import * as React from 'react';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import {
    builderFieldsForQuery,
    fromCel,
    preserveBuilderLiteralTypes,
    toCel,
} from '../../../../common/LoopConditionQuery';
import type { LoopConditionGroup } from '../../../../common/LoopConditionQuery';
import './LoopConditionBuilder.css';

interface LoopConditionBuilderProps {
    onChange: (celText: string) => void;
    value: string;
}

/** Operators the builder can represent, in RQB-compatible format. */
const BUILDER_OPERATORS = [{
    label: 'equals',
    name: '==',
    operators: ['=='],
}, {
    label: 'not equals',
    name: '!=',
    operators: ['!='],
}, {
    label: 'less than',
    name: '<',
    operators: ['<'],
}, {
    label: 'less or equal',
    name: '<=',
    operators: ['<='],
}, {
    label: 'greater than',
    name: '>',
    operators: ['>'],
}, {
    label: 'greater or equal',
    name: '>=',
    operators: ['>='],
}];

export function LoopConditionBuilder({ onChange, value }: LoopConditionBuilderProps) {
    // Load only when this mode is opened; state schedules a render when the chunk arrives.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RQB's v8 generic component type is too broad for the adapter's small query shape.
    const [QBuilder, setQBuilder] = React.useState<React.ComponentType<any> | null>(null);
    const [loadError, setLoadError] = React.useState(false);
    const [query, setQuery] = React.useState<LoopConditionGroup>(() => queryForBuilder(value));
    const lastEmittedValue = React.useRef<string | null>(null);
    const fields = React.useMemo(() => builderFieldsForQuery(query), [query]);

    React.useEffect(() => {
        let mounted = true;
        import('react-querybuilder')
            .then((mod) => {
                if (mounted) setQBuilder(() => mod.QueryBuilder);
            })
            .catch(() => {
                if (mounted) setLoadError(true);
            });
        return () => { mounted = false; };
    }, []);

    // Echoes caused by our own edits must not replace RQB's rule ids and steal input focus.
    React.useEffect(() => {
        if (value === lastEmittedValue.current) {
            lastEmittedValue.current = null;
            return;
        }
        const parsed = fromCel(value);
        if (!parsed.query) return;
        setQuery(queryForBuilder(value));
    }, [value]);

    if (loadError) {
        return <Alert severity="error" data-testid="loop-condition-builder-error">
            The visual condition builder could not be loaded. Switch to CEL text to edit the condition.
        </Alert>;
    }
    if (!QBuilder) {
        return <Box display="flex" alignItems="center" gap={1} data-testid="loop-condition-builder-loading">
            <CircularProgress size={18} />
            <Typography variant="body2">Loading visual condition builder…</Typography>
        </Box>;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Operators array uses simplified types compatible with RQB runtime.
    return (
        <Box className="loop-condition-builder">
            {React.createElement(QBuilder, {
                query,
                fields,
                getDefaultField: fields[0]?.name,
                parseNumbers: 'strict-limited',
                onQueryChange: (nextQuery: LoopConditionGroup) => {
                    const typedQuery = preserveBuilderLiteralTypes(nextQuery, query);
                    setQuery(typedQuery);
                    const celText = toCel(typedQuery);
                    if (celText) {
                        lastEmittedValue.current = celText;
                        onChange(celText);
                    }
                },
                operators: BUILDER_OPERATORS as any,
                showNotToggle: true,
            })}
        </Box>
    );
}

function queryForBuilder(value: string): LoopConditionGroup {
    const parsed = fromCel(value).query;
    return parsed ? preserveBuilderLiteralTypes(parsed, parsed) : emptyQuery();
}

function emptyQuery(): LoopConditionGroup {
    return {
        combinator: 'and',
        rules: [{ field: '', operator: '==', value: true }],
    };
}
