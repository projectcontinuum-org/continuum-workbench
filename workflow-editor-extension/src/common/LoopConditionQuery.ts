/**
 * Lossless adapter between loop-condition CEL and React Query Builder queries.
 * CEL variable-map references are mapped to safe temporary fields while RQB parses
 * and formats; the visual query always stores the original flow-variable name.
 */

import { formatQuery } from 'react-querybuilder/formatQuery';
import { parseCEL } from 'react-querybuilder/parseCEL';
import type { LiteralType } from './LoopConditionRules';

export const DEFAULT_LOOP_CONDITION = 'vars["hasMore"] == true';

export const SUPPORTED_SHAPE =
    'Nested and/or groups, group negation, and supported comparisons over flow variables and literals.';

export interface LoopConditionRule {
    id?: string;
    field: string;
    operator: string;
    value: unknown;
    valueSource?: string;
    literalType?: LiteralType;
}

export interface LoopConditionGroup {
    id?: string;
    combinator: string;
    rules: Array<LoopConditionRule | LoopConditionGroup>;
    not?: boolean;
}

export interface ParsedCondition {
    readonly variable: string;
    readonly operator: string;
    readonly literalType: LiteralType;
    readonly literalValue: unknown;
}

export interface BuilderImport {
    query: LoopConditionGroup | null;
    fits: boolean;
}

export interface LoopConditionBuilderField {
    name: string;
    label: string;
    valueEditorType: 'checkbox' | 'text';
    inputType?: 'number';
}

const COMPARISON_OPERATORS = new Set(['==', '=', '!=', '<', '<=', '>', '>=']);

export function fitsBuilder(condition: string): boolean {
    return fromCel(condition).fits;
}

/** Parse only when every group and rule can be exported without changing its CEL meaning. */
export function fromCel(condition: string): BuilderImport {
    if (!condition.trim()) {
        return { query: null, fits: false };
    }

    try {
        const rewritten = rewriteFlowVariableReferences(condition);
        const parsed = parseCEL(rewritten.text) as unknown as LoopConditionGroup;
        const mapped = mapQueryFields(parsed, (field) => rewritten.variables.get(field) ?? '');
        const normalized = normalizeNegatedGroups(mapped);
        if (!isSupportedQuery(normalized)) {
            return { query: null, fits: false };
        }

        const emitted = toCel(normalized);
        return conditionsEquivalent(condition, emitted) || queryTreesEquivalent(normalized, emitted)
            ? { query: normalized, fits: true }
            : { query: null, fits: false };
    } catch {
        return { query: null, fits: false };
    }
}

/** Serialize a complete nested query, including combinators and group negation. */
export function toCel(query: LoopConditionGroup): string {
    const typedQuery = coerceQueryLiterals(query);
    if (!typedQuery || !isSupportedQuery(typedQuery)) {
        return '';
    }

    const placeholders = createFieldPlaceholders(typedQuery);
    const formattedQuery = mapQueryFields(typedQuery, (field) => placeholders.fields.get(field) ?? '');
    const formatted = formatQuery(formattedQuery as never, 'cel');
    return replaceIdentifiersOutsideStrings(formatted, placeholders.expressions);
}

/** Retain the original CEL literal type when the builder emits a text input value. */
export function preserveBuilderLiteralTypes(
    query: LoopConditionGroup,
    previousQuery: LoopConditionGroup,
): LoopConditionGroup {
    return {
        ...query,
        rules: query.rules.map((item, index) => {
            const previous = previousQuery.rules[index];
            if (isQueryGroup(item)) {
                return isQueryGroup(previous)
                    ? preserveBuilderLiteralTypes(item, previous)
                    : preserveBuilderLiteralTypes(item, { combinator: 'and', rules: [] });
            }
            if (item.literalType) return item;
            const previousType = previous && !isQueryGroup(previous)
                ? previous.literalType ?? literalTypeOf(previous.value)
                : null;
            return { ...item, literalType: previousType ?? literalTypeOf(item.value) ?? undefined };
        }),
    };
}

/** Give each condition variable a visible field and an editor suited to its literal type. */
export function builderFieldsForQuery(query: LoopConditionGroup): LoopConditionBuilderField[] {
    const literalTypes = new Map<string, LiteralType>();
    collectLiteralTypes(query, literalTypes);
    return Array.from(literalTypes, ([name, literalType]) => ({
        name,
        label: name,
        valueEditorType: literalType === 'boolean' ? 'checkbox' : 'text',
        ...(literalType === 'integer' || literalType === 'double' ? { inputType: 'number' as const } : {}),
    }));
}

/** Parse a single-rule query for compact node summaries. */
export function parseCondition(condition: string): ParsedCondition | null {
    const query = fromCel(condition).query;
    const onlyRule = query?.rules.length === 1 ? query.rules[0] : undefined;
    if (!query || query.not || !onlyRule || isQueryGroup(onlyRule)) {
        return null;
    }
    const literalType = literalTypeOf(onlyRule.value);
    return literalType
        ? {
            variable: onlyRule.field,
            operator: normalizeOperator(onlyRule.operator),
            literalType,
            literalValue: onlyRule.value,
        }
        : null;
}

/** Serialize a parsed single comparison in canonical CEL form. */
export function formatCondition(parsed: ParsedCondition): string {
    const variable = `vars["${escapeCelString(parsed.variable)}"]`;
    const literalType = parsed.literalType ?? literalTypeOf(parsed.literalValue) ?? 'string';
    return `${variable} ${parsed.operator} ${formatLiteral(parsed.literalValue, literalType)}`;
}

export function operatorsFor(literalType: LiteralType): string[] {
    switch (literalType) {
        case 'boolean': return ['==', '!='];
        case 'string': return ['==', '!=', 'contains', 'startsWith', 'endsWith'];
        case 'integer':
        case 'double': return ['==', '!=', '<', '<=', '>', '>='];
        default: return ['==', '!='];
    }
}

function isSupportedQuery(query: LoopConditionGroup): boolean {
    if (!isQueryGroup(query) || !['and', 'or'].includes(query.combinator) || query.rules.length === 0) {
        return false;
    }
    return query.rules.every((item) => isQueryGroup(item) ? isSupportedQuery(item) : isSupportedRule(item));
}

function isSupportedRule(rule: LoopConditionRule): boolean {
    return typeof rule.field === 'string'
        && rule.field.length > 0
        && COMPARISON_OPERATORS.has(rule.operator)
        && (rule.valueSource === undefined || rule.valueSource === 'value')
        && coerceLiteral(rule.value, rule.literalType) !== null;
}

function coerceQueryLiterals(query: LoopConditionGroup): LoopConditionGroup | null {
    const rules: Array<LoopConditionRule | LoopConditionGroup> = [];
    for (const item of query.rules) {
        if (isQueryGroup(item)) {
            const group = coerceQueryLiterals(item);
            if (!group) return null;
            rules.push(group);
            continue;
        }
        const literalType = item.literalType ?? literalTypeOf(item.value);
        const value = coerceLiteral(item.value, literalType ?? undefined);
        if (value === null || literalType === null) return null;
        rules.push({ ...item, value, literalType });
    }
    return { ...query, rules };
}

function coerceLiteral(value: unknown, literalType?: LiteralType): unknown | null {
    const type = literalType ?? literalTypeOf(value) ?? undefined;
    if (!type) return null;
    if (type === 'string') return typeof value === 'string' ? value : null;
    if (type === 'boolean') {
        if (typeof value === 'boolean') return value;
        if (value === 'true') return true;
        if (value === 'false') return false;
        return null;
    }
    if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
    const number = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(number) || (type === 'integer' && !Number.isInteger(number))) return null;
    return number;
}

function isQueryGroup(value: unknown): value is LoopConditionGroup {
    return typeof value === 'object'
        && value !== null
        && Array.isArray((value as LoopConditionGroup).rules);
}

function mapQueryFields(
    query: LoopConditionGroup,
    mapField: (field: string) => string,
): LoopConditionGroup {
    return {
        ...query,
        rules: query.rules.map((item) => isQueryGroup(item)
            ? mapQueryFields(item, mapField)
            : { ...item, field: mapField(item.field), operator: normalizeOperator(item.operator) }),
    };
}

function normalizeNegatedGroups(query: LoopConditionGroup): LoopConditionGroup {
    const rules = query.rules.map((item) => isQueryGroup(item) ? normalizeNegatedGroups(item) : item);
    const onlyRule = rules.length === 1 ? rules[0] : undefined;
    if (query.not && isQueryGroup(onlyRule) && !onlyRule.not) {
        const id = query.id ?? onlyRule.id;
        return id === undefined
            ? { ...onlyRule, not: true }
            : { ...onlyRule, not: true, id };
    }
    return { ...query, rules };
}

function createFieldPlaceholders(query: LoopConditionGroup): {
    fields: Map<string, string>;
    expressions: Map<string, string>;
} {
    const fields = new Map<string, string>();
    const expressions = new Map<string, string>();
    const knownFields = collectFields(query);
    for (const field of knownFields) {
        let token = `__loop_flow_variable_${fields.size}__`;
        while (fields.has(token) || knownFields.includes(token)) {
            token = `_${token}`;
        }
        fields.set(field, token);
        expressions.set(token, `vars["${escapeCelString(field)}"]`);
    }
    return { fields, expressions };
}

function collectFields(query: LoopConditionGroup): string[] {
    return query.rules.flatMap((item) =>
        isQueryGroup(item) ? collectFields(item) : [item.field],
    ).filter((field, index, fields) => fields.indexOf(field) === index);
}

function rewriteFlowVariableReferences(text: string): { text: string; variables: Map<string, string> } {
    const variables = new Map<string, string>();
    let result = '';
    for (let index = 0; index < text.length;) {
        const quoteEnd = quotedStringEnd(text, index);
        if (quoteEnd > index) {
            result += text.slice(index, quoteEnd);
            index = quoteEnd;
            continue;
        }

        const reference = readFlowVariableReference(text, index);
        if (reference) {
            const token = `__loop_flow_variable_${variables.size}__`;
            variables.set(token, reference.name);
            result += token;
            index = reference.end;
            continue;
        }
        result += text[index];
        index += 1;
    }
    return { text: result, variables };
}

function readFlowVariableReference(text: string, index: number): { name: string; end: number } | null {
    if (text.startsWith('vars[', index)) {
        const start = index + 5;
        if (text[start] !== '"' && text[start] !== "'") return null;
        const end = quotedStringEnd(text, start);
        if (end <= start || text[end] !== ']') {
            return null;
        }
        const name = decodeCelString(text.slice(start + 1, end - 1));
        return name === null ? null : { name, end: end + 1 };
    }

    const property = text.slice(index).match(/^vars\.([A-Za-z_][A-Za-z0-9_]*)/);
    if (!property || (index > 0 && isIdentifierPart(text[index - 1]))) {
        return null;
    }
    return { name: property[1], end: index + property[0].length };
}

function replaceIdentifiersOutsideStrings(text: string, replacements: Map<string, string>): string {
    let result = '';
    for (let index = 0; index < text.length;) {
        const quoteEnd = quotedStringEnd(text, index);
        if (quoteEnd > index) {
            result += text.slice(index, quoteEnd);
            index = quoteEnd;
            continue;
        }
        if (isIdentifierStart(text[index])) {
            const end = readIdentifierEnd(text, index);
            const identifier = text.slice(index, end);
            result += replacements.get(identifier) ?? identifier;
            index = end;
            continue;
        }
        result += text[index];
        index += 1;
    }
    return result;
}

function quotedStringEnd(text: string, start: number): number {
    const quote = text[start];
    if (quote !== '"' && quote !== "'") {
        return start;
    }
    const delimiter = text.startsWith(quote.repeat(3), start) ? quote.repeat(3) : quote;
    const raw = start > 0 && text[start - 1] === 'r';
    for (let index = start + delimiter.length; index < text.length;) {
        if (!raw && text[index] === '\\') {
            index += 2;
        } else if (text.startsWith(delimiter, index)) {
            return index + delimiter.length;
        } else {
            index += 1;
        }
    }
    return text.length;
}

function readIdentifierEnd(text: string, start: number): number {
    let end = start + 1;
    while (end < text.length && isIdentifierPart(text[end])) {
        end += 1;
    }
    return end;
}

function isIdentifierStart(character: string | undefined): boolean {
    return character !== undefined && /[A-Za-z_]/.test(character);
}

function isIdentifierPart(character: string | undefined): boolean {
    return character !== undefined && /[A-Za-z0-9_]/.test(character);
}

function conditionsEquivalent(left: string, right: string): boolean {
    const normalizedLeft = normalizeCelWhitespace(rewriteFlowVariableReferences(left).text);
    const normalizedRight = normalizeCelWhitespace(rewriteFlowVariableReferences(right).text);
    return normalizedLeft === normalizedRight;
}

function queryTreesEquivalent(query: LoopConditionGroup, cel: string): boolean {
    try {
        const rewritten = rewriteFlowVariableReferences(cel);
        const parsed = parseCEL(rewritten.text) as unknown as LoopConditionGroup;
        const emittedQuery = normalizeNegatedGroups(
            mapQueryFields(parsed, (field) => rewritten.variables.get(field) ?? ''),
        );
        return queryShapeEquals(query, emittedQuery);
    } catch {
        return false;
    }
}

function queryShapeEquals(left: LoopConditionGroup, right: LoopConditionGroup): boolean {
    if (!isQueryGroup(left) || !isQueryGroup(right)
        || left.combinator !== right.combinator
        || !!left.not !== !!right.not
        || left.rules.length !== right.rules.length) {
        return false;
    }
    return left.rules.every((item, index) => {
        const other = right.rules[index];
        if (isQueryGroup(item) || isQueryGroup(other)) {
            return isQueryGroup(item) && isQueryGroup(other) && queryShapeEquals(item, other);
        }
        return item.field === other.field
            && normalizeOperator(item.operator) === normalizeOperator(other.operator)
            && Object.is(item.value, other.value)
            && item.valueSource === other.valueSource;
    });
}

function normalizeCelWhitespace(text: string): string {
    let result = '';
    for (let index = 0; index < text.length;) {
        const quoteEnd = quotedStringEnd(text, index);
        if (quoteEnd > index) {
            result += text.slice(index, quoteEnd);
            index = quoteEnd;
        } else if (/\s/.test(text[index])) {
            index += 1;
        } else {
            result += text[index];
            index += 1;
        }
    }
    return stripRedundantOuterParentheses(result);
}

function stripRedundantOuterParentheses(text: string): string {
    let result = text;
    while (result.startsWith('(') && result.endsWith(')')) {
        let depth = 0;
        let closesAtEnd = true;
        for (let index = 0; index < result.length; index += 1) {
            const quoteEnd = quotedStringEnd(result, index);
            if (quoteEnd > index) {
                index = quoteEnd - 1;
            } else if (result[index] === '(') {
                depth += 1;
            } else if (result[index] === ')') {
                depth -= 1;
                if (depth === 0 && index < result.length - 1) {
                    closesAtEnd = false;
                    break;
                }
            }
        }
        if (!closesAtEnd || depth !== 0) break;
        result = result.slice(1, -1);
    }
    return result;
}

function literalTypeOf(value: unknown): LiteralType | null {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number' && Number.isFinite(value)) return Number.isInteger(value) ? 'integer' : 'double';
    return typeof value === 'string' ? 'string' : null;
}

function collectLiteralTypes(query: LoopConditionGroup, types: Map<string, LiteralType>): void {
    for (const item of query.rules) {
        if (isQueryGroup(item)) {
            collectLiteralTypes(item, types);
            continue;
        }
        const literalType = item.literalType ?? literalTypeOf(item.value);
        if (literalType && !types.has(item.field)) types.set(item.field, literalType);
    }
}

function normalizeOperator(operator: string): string {
    return operator === '=' ? '==' : operator;
}

function decodeCelString(text: string): string | null {
    let decoded = '';
    for (let index = 0; index < text.length; index += 1) {
        if (text[index] !== '\\') {
            decoded += text[index];
            continue;
        }
        index += 1;
        const escape = text[index];
        const replacements: Record<string, string> = {
            '"': '"', "'": "'", '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t',
        };
        if (escape in replacements) {
            decoded += replacements[escape];
        } else if (escape === 'u') {
            const hex = text.slice(index + 1, index + 5);
            if (!/^[\da-fA-F]{4}$/.test(hex)) return null;
            decoded += String.fromCharCode(Number.parseInt(hex, 16));
            index += 4;
        } else {
            return null;
        }
    }
    return decoded;
}

function formatLiteral(value: unknown, type: LiteralType): string {
    switch (type) {
        case 'boolean': return String(value);
        case 'integer':
        case 'double': return Number(value).toString();
        case 'string': return `"${escapeCelString(String(value))}"`;
    }
}

function escapeCelString(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/\f/g, '\\f')
        .replace(/\x08/g, '\\b');
}
