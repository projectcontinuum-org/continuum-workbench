/** Share of the history event cap that is used, clamped to 0-100; undefined when either value is missing or the cap is not positive. */
export function historyUsagePercent(count?: number, limit?: number): number | undefined {
    if (count === undefined || limit === undefined || !(limit > 0) || count < 0) {
        return undefined;
    }
    return Math.min(100, (count / limit) * 100);
}
