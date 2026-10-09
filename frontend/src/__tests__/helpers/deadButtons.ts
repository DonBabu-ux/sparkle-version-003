/**
 * AST-based dead-button inventory (C3.2).
 * A <button> is dead when it has no handler on itself (on* / type=submit /
 * disabled / aria-disabled / spread attrs) and no JSX ancestor carries one
 * (Link/label/a or any element with a handler).
 */
import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../..', import.meta.url)); // frontend/src

const EVENT_ATTR = /^(on[A-Z]|type$|disabled$|aria-disabled$|form$)/;
const WRAPPERS = /^(Link|NavLink|a|label|SettingRow|Pressable|Touchable)$/;

function getAttrs(el: ts.JsxElement | ts.JsxSelfClosingElement): ts.JsxAttributes | undefined {
    return ts.isJsxSelfClosingElement(el) ? el.attributes : el.openingElement.attributes;
}

function getTagName(el: ts.JsxElement | ts.JsxSelfClosingElement): string {
    const target = ts.isJsxElement(el) ? el.openingElement : el;
    return target.tagName.getText();
}

function hasHandlerAttr(el: ts.JsxElement | ts.JsxSelfClosingElement): boolean {
    const props = getAttrs(el)?.properties;
    if (!props) return false;
    for (const p of props) {
        if (ts.isJsxSpreadAttribute(p)) return true; // unknown — assume props carry behaviour
        if (!ts.isJsxAttribute(p)) continue;
        const name = p.name.getText();
        if (!EVENT_ATTR.test(name)) continue;
        if (name === 'type') {
            if ((p.initializer?.getText?.() ?? '').includes('submit')) return true;
            continue;
        }
        if (name === 'disabled' || name === 'aria-disabled') {
            const t = p.initializer?.getText?.() ?? '';
            if (t === '' || t === 'true' || t === '{true}') return true;
            continue;
        }
        return true; // on* or form
    }
    return false;
}

function ancestorHandles(node: ts.Node): string | null {
    let cur = node.parent;
    while (cur) {
        if (ts.isJsxSelfClosingElement(cur) || ts.isJsxElement(cur)) {
            const tag = getTagName(cur);
            if (WRAPPERS.test(tag)) return tag;
            if (hasHandlerAttr(cur)) return tag || 'handler';
        }
        cur = cur.parent;
    }
    return null;
}

export interface DeadButton {
    file: string;
    line: number;
    label: string;
}

function labelOf(el: ts.JsxElement | ts.JsxSelfClosingElement): string {
    const attrs = getAttrs(el)?.properties;
    if (attrs) {
        for (const p of attrs) {
            if (ts.isJsxAttribute(p) && p.name.getText() === 'aria-label') {
                const m = (p.initializer?.getText?.() ?? '').match(/['"](.+?)['"]/);
                if (m) return m[1];
            }
        }
    }
    const kids = ts.isJsxElement(el) ? el.children : [];
    for (const k of kids) {
        if (ts.isJsxText(k)) {
            const t = k.text.trim().replace(/\s+/g, ' ');
            if (t) return t.slice(0, 60);
        }
        if (ts.isJsxExpression(k) && k.expression && ts.isStringLiteral(k.expression)) {
            return k.expression.text.slice(0, 60);
        }
        if (ts.isJsxElement(k) || ts.isJsxSelfClosingElement(k)) {
            const nested = labelOf(k);
            if (nested) return nested;
        }
    }
    return '';
}

function walk(dir: string): string[] {
    return (readdirSync(dir, { recursive: true }) as string[])
        .filter((f) => f.endsWith('.tsx'))
        .map((f) => join(dir, f));
}

export function findDeadButtons(): DeadButton[] {
    const dead: DeadButton[] = [];
    for (const file of walk(SRC)) {
        if (file.split(/[/\\]/).includes('__tests__')) continue;
        const code = readFileSync(file, 'utf8');
        const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        const visit = (node: ts.Node) => {
            if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
                if (getTagName(node) === 'button' && !hasHandlerAttr(node) && !ancestorHandles(node)) {
                    const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
                    dead.push({
                        file: relative(SRC, file),
                        line: pos.line + 1,
                        label: labelOf(node) || '(no text)',
                    });
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sf);
    }
    return dead;
}

const SKIP_INPUT_TYPES = new Set(['hidden', 'submit', 'button', 'file', 'checkbox', 'radio', 'range', 'color']);

function insideSubmittingForm(node: ts.Node): boolean {
    let cur = node.parent;
    while (cur) {
        if ((ts.isJsxElement(cur) || ts.isJsxSelfClosingElement(cur)) && getTagName(cur) === 'form') {
            return hasHandlerAttr(cur); // form must have onSubmit
        }
        cur = cur.parent;
    }
    return false;
}

/** Text-like inputs with no onChange, no readOnly/disabled, not inside a submitting form. */
export function findDeadInputs(): DeadButton[] {
    const dead: DeadButton[] = [];
    for (const file of walk(SRC)) {
        if (file.split(/[/\\]/).includes('__tests__')) continue;
        const code = readFileSync(file, 'utf8');
        const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        const visit = (node: ts.Node) => {
            if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
                if (getTagName(node) === 'input') {
                    let type = 'text';
                    let hasChange = false;
                    let skip = false;
                    for (const p of getAttrs(node)?.properties ?? []) {
                        if (ts.isJsxSpreadAttribute(p)) { skip = true; break; }
                        if (!ts.isJsxAttribute(p)) continue;
                        const name = p.name.getText();
                        const init = p.initializer?.getText?.() ?? '';
                        if (name === 'type') type = (init.match(/['"](\w+)['"]/) || [])[1] || type;
                        if (name === 'onChange') hasChange = true;
                        if (name === 'readOnly' || name === 'disabled') skip = true;
                        if (/^on[A-Z]/.test(name)) skip = true;
                    }
                    if (!skip && !hasChange && !SKIP_INPUT_TYPES.has(type) && !insideSubmittingForm(node)) {
                        const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
                        dead.push({
                            file: relative(SRC, file),
                            line: pos.line + 1,
                            label: labelOf(node) || '(no text)',
                        });
                    }
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sf);
    }
    return dead;
}
