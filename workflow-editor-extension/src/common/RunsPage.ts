/**
 * Pages of `GET /api/v1/workflow-runs` and `/distinct-workflows`. The api-server serializes Spring Data pages as
 * `PagedModel` (`@EnableSpringDataWebSupport(VIA_DTO)`): the paging numbers are under `page`, not at the top level.
 * Reading a top-level `totalPages` gives `undefined`, so "Load more" never appeared. Always read pages through
 * {@link readRunsPage}.
 */

/** A page as the api-server sends it. */
export interface PagedModel<T> {
    content: T[];
    page?: {
        size?: number;
        number?: number;
        totalElements?: number;
        totalPages?: number;
    };
}

/** A page as the workbench uses it. */
export interface RunsPage<T> {
    content: T[];
    /** Zero-based number of this page. */
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
}

/**
 * Flattens a `PagedModel` into a {@link RunsPage}. Missing numbers fall back to what `content` shows, so a page
 * without metadata is treated as the only page instead of producing `NaN` comparisons.
 */
export function readRunsPage<T>(body: PagedModel<T> | null | undefined): RunsPage<T> {
    const content = Array.isArray(body?.content) ? body!.content : [];
    const page = body?.page ?? {};
    const totalElements = finiteOr(page.totalElements, content.length);
    return {
        content,
        number: finiteOr(page.number, 0),
        size: finiteOr(page.size, content.length),
        totalElements,
        totalPages: finiteOr(page.totalPages, content.length > 0 ? 1 : 0),
    };
}

/** Whether a page after `pageNumber` (zero-based) exists. */
export function hasMorePages(page: RunsPage<unknown>, pageNumber: number): boolean {
    return pageNumber + 1 < page.totalPages;
}

function finiteOr(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
