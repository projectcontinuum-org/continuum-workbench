import DOMPurify from 'dompurify';

/** The parts of a DOMPurify instance used here, so tests can pass one bound to a jsdom window. */
export interface SvgPurifier {
    readonly isSupported: boolean;
    sanitize(dirty: string, config: { USE_PROFILES: { svg: boolean; svgFilters: boolean } }): unknown;
}

/**
 * Remove scripts, event handlers, javascript: links, foreignObject and anything else that is not
 * plain SVG from markup that will be rendered inline (react-inlinesvg's `preProcessor`).
 * If there is no DOM, DOMPurify hands back the input unchanged, so this returns '' instead.
 */
export function sanitizeSvg(svg: string, purifier: SvgPurifier = DOMPurify): string {
    if (!purifier.isSupported) {
        return '';
    }
    const clean = purifier.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
    return typeof clean === 'string' ? clean : '';
}
