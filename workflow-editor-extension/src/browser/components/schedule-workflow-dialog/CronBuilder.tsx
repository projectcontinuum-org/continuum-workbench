import * as React from 'react';
import { Box, FormControl, InputLabel, MenuItem, Select, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';

export type CronFrequency = 'minutes' | 'hours' | 'daily' | 'weekly' | 'monthly';

const WEEKDAYS = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
];

const DEFAULT_HOUR = 9;
const DEFAULT_MINUTE = 0;

interface CronState {
    frequency: CronFrequency;
    minuteInterval: number;
    hourInterval: number;
    hour: number;
    minute: number;
    weekDays: number[];
    monthDay: number;
}

const DEFAULT_STATE: CronState = {
    frequency: 'daily',
    minuteInterval: 5,
    hourInterval: 1,
    hour: DEFAULT_HOUR,
    minute: DEFAULT_MINUTE,
    weekDays: [new Date().getDay()],
    monthDay: 1,
};

function buildCron(state: CronState): string {
    const { frequency, minuteInterval, hourInterval, hour, minute, weekDays, monthDay } = state;
    switch (frequency) {
        case 'minutes':
            return `*/${minuteInterval} * * * *`;
        case 'hours':
            return `0 */${hourInterval} * * *`;
        case 'daily':
            return `${minute} ${hour} * * *`;
        case 'weekly': {
            const days = weekDays.length ? [...weekDays].sort((a, b) => a - b) : [new Date().getDay()];
            return `${minute} ${hour} * * ${days.join(',')}`;
        }
        case 'monthly':
            return `${minute} ${hour} ${monthDay} * *`;
    }
}

/**
 * Best-effort match of an incoming cron string to one of the 5 supported presets.
 * Falls back to the Daily preset when the expression doesn't match any of them —
 * round-tripping arbitrary hand-typed expressions isn't guaranteed, Advanced mode
 * covers anything more exotic.
 */
function parseCron(cron: string): CronState {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) {
        return DEFAULT_STATE;
    }
    const [min, hr, dom, , dow] = parts;

    const minutesEvery = min.match(/^\*\/(\d+)$/);
    if (minutesEvery && hr === '*' && dom === '*' && dow === '*') {
        return { ...DEFAULT_STATE, frequency: 'minutes', minuteInterval: Number(minutesEvery[1]) };
    }

    const hoursEvery = hr.match(/^\*\/(\d+)$/);
    if (min === '0' && hoursEvery && dom === '*' && dow === '*') {
        return { ...DEFAULT_STATE, frequency: 'hours', hourInterval: Number(hoursEvery[1]) };
    }

    const minuteNum = Number(min);
    const hourNum = Number(hr);
    const isFixedTime = Number.isInteger(minuteNum) && Number.isInteger(hourNum) && min !== '*' && hr !== '*';

    if (isFixedTime && dom === '*' && dow === '*') {
        return { ...DEFAULT_STATE, frequency: 'daily', hour: hourNum, minute: minuteNum };
    }

    if (isFixedTime && dom === '*' && dow !== '*') {
        const days = dow.split(',').map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6);
        if (days.length) {
            return { ...DEFAULT_STATE, frequency: 'weekly', hour: hourNum, minute: minuteNum, weekDays: days };
        }
    }

    const domNum = Number(dom);
    if (isFixedTime && Number.isInteger(domNum) && domNum >= 1 && domNum <= 31 && dow === '*') {
        return { ...DEFAULT_STATE, frequency: 'monthly', hour: hourNum, minute: minuteNum, monthDay: domNum };
    }

    return DEFAULT_STATE;
}

function formatTime(hour: number, minute: number): string {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseTime(time: string): { hour: number; minute: number } {
    const [h, m] = time.split(':').map(Number);
    return { hour: h || 0, minute: m || 0 };
}

export interface CronBuilderProps {
    value: string;
    onChange: (cron: string) => void;
    disabled?: boolean;
}

export default function CronBuilder({ value, onChange, disabled }: CronBuilderProps) {
    const [state, setState] = React.useState<CronState>(() => parseCron(value));
    const lastEmitted = React.useRef(value);

    React.useEffect(() => {
        if (value !== lastEmitted.current) {
            setState(parseCron(value));
        }
    }, [value]);

    const update = React.useCallback((patch: Partial<CronState>) => {
        setState(prev => {
            const next = { ...prev, ...patch };
            const cron = buildCron(next);
            lastEmitted.current = cron;
            onChange(cron);
            return next;
        });
    }, [onChange]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <FormControl size="small" disabled={disabled} sx={{ minWidth: 160 }}>
                <InputLabel id="cron-frequency-label">Frequency</InputLabel>
                <Select
                    labelId="cron-frequency-label"
                    label="Frequency"
                    value={state.frequency}
                    onChange={(e) => update({ frequency: e.target.value as CronFrequency })}
                >
                    <MenuItem value="minutes">Every N minutes</MenuItem>
                    <MenuItem value="hours">Every N hours</MenuItem>
                    <MenuItem value="daily">Daily</MenuItem>
                    <MenuItem value="weekly">Weekly</MenuItem>
                    <MenuItem value="monthly">Monthly</MenuItem>
                </Select>
            </FormControl>

            {state.frequency === 'minutes' && (
                <TextField
                    type="number"
                    label="Every"
                    size="small"
                    disabled={disabled}
                    value={state.minuteInterval}
                    inputProps={{ min: 1, max: 59 }}
                    helperText="Minutes between runs (1–59)"
                    sx={{ maxWidth: 220 }}
                    onChange={(e) => update({ minuteInterval: Math.min(59, Math.max(1, Number(e.target.value) || 1)) })}
                />
            )}

            {state.frequency === 'hours' && (
                <TextField
                    type="number"
                    label="Every"
                    size="small"
                    disabled={disabled}
                    value={state.hourInterval}
                    inputProps={{ min: 1, max: 23 }}
                    helperText="Hours between runs (1–23), on the hour"
                    sx={{ maxWidth: 220 }}
                    onChange={(e) => update({ hourInterval: Math.min(23, Math.max(1, Number(e.target.value) || 1)) })}
                />
            )}

            {state.frequency === 'daily' && (
                <TextField
                    type="time"
                    label="At"
                    size="small"
                    disabled={disabled}
                    value={formatTime(state.hour, state.minute)}
                    sx={{ maxWidth: 220 }}
                    onChange={(e) => update(parseTime(e.target.value))}
                />
            )}

            {state.frequency === 'weekly' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <ToggleButtonGroup
                        size="small"
                        value={state.weekDays}
                        disabled={disabled}
                        onChange={(_, days: number[]) => update({ weekDays: days })}
                    >
                        {WEEKDAYS.map(d => (
                            <ToggleButton
                                key={d.value}
                                value={d.value}
                                sx={{ fontSize: '11px', padding: '2px 6px', textTransform: 'none' }}>
                                {d.label}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                    <TextField
                        type="time"
                        label="At"
                        size="small"
                        disabled={disabled}
                        value={formatTime(state.hour, state.minute)}
                        sx={{ maxWidth: 220 }}
                        onChange={(e) => update(parseTime(e.target.value))}
                    />
                </Box>
            )}

            {state.frequency === 'monthly' && (
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <TextField
                        type="number"
                        label="Day of month"
                        size="small"
                        disabled={disabled}
                        value={state.monthDay}
                        inputProps={{ min: 1, max: 31 }}
                        sx={{ maxWidth: 160 }}
                        onChange={(e) => update({ monthDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })}
                    />
                    <TextField
                        type="time"
                        label="At"
                        size="small"
                        disabled={disabled}
                        value={formatTime(state.hour, state.minute)}
                        sx={{ maxWidth: 220 }}
                        onChange={(e) => update(parseTime(e.target.value))}
                    />
                </Box>
            )}
        </Box>
    );
}
