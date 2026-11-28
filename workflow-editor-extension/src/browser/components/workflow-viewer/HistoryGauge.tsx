import React from 'react';
import { Box, CircularProgress, Tooltip, Typography } from '@mui/material';
import { historyUsagePercent } from '../../../common/HistoryUsage';

export interface HistoryGaugeProps {
    count?: number;
    limit?: number;
}

export default function HistoryGauge({ count, limit }: HistoryGaugeProps) {
    const percent = historyUsagePercent(count, limit);
    if (percent === undefined) {
        return null;
    }
    const color = percent > 80 ? 'error' : percent > 50 ? 'warning' : 'success';
    return (
        <Tooltip title={`Workflow history: ${count!.toLocaleString()} of ${limit!.toLocaleString()} events recorded`}>
            <Box role="meter" aria-label="Workflow history events used" aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={Math.round(percent)} sx={{ position: 'relative', display: 'inline-flex' }}>
                <CircularProgress variant="determinate" value={100} size={36} thickness={4}
                    sx={{ position: 'absolute', color: 'action.disabledBackground' }} />
                <CircularProgress variant="determinate" value={percent} size={36} thickness={4} color={color} />
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="caption" sx={{ fontSize: 10, lineHeight: 1 }}>{Math.round(percent)}%</Typography>
                </Box>
            </Box>
        </Tooltip>
    );
}
