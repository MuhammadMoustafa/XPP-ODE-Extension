import { XppModel, Declaration, isKeywordLikeName } from './xppModel';

export interface SemanticResult {
    message: string;
    line: number;
    start: number;
    end: number;
    severity: 'error' | 'warning' | 'information';
    type: 'undefined' | 'unused' | 'init-target' | 'ignored-line' | 'keyword-name' | 'option' | 'syntax';
    /** Render the range faded (VS Code "unnecessary" tag). */
    unnecessary?: boolean;
}

/** Declarations that never need to be referenced to be useful. */
const NEVER_UNUSED: Set<Declaration['kind']> = new Set(['state', 'aux', 'solv', 'array']);

/** Declarations whose names may be targets of "init" / "x(0)=". */
const INIT_TARGETS: Set<Declaration['kind']> = new Set(['state', 'markov', 'array', 'solv']);

export const IGNORED_LINE_MESSAGE =
    'XPP does not recognise this line and silently ignores it. Declarations start with ' +
    'p(ar), i(nit), au(x), w(iener), n(umber), g(lobal), b(dry), v(olt), ma(rkov), ta(ble), se(t), so(lv), ' +
    'sp(ecial), ex(port), im(port), on(ly), o(ptions) or d(one), followed by a space (tabs do not count); ' +
    'equations look like x\'=, dx/dt=, x(t+1)=, x(0)=, f(x)=, name=, !name= or 0=.';

/**
 * Semantic checks on a parsed file.
 * `externalNames` are names declared elsewhere (e.g. in #include'd files or, for an .inc file,
 * in the .ode that includes it); when `skipUndefined` is set, undefined-name checks are disabled.
 */
export function checkSemantics(
    model: XppModel,
    externalNames: Set<string> = new Set(),
    skipUndefined = false
): SemanticResult[] {
    const results: SemanticResult[] = [];
    const declaredByName = new Map<string, Declaration[]>();
    for (const decl of model.declarations) {
        const list = declaredByName.get(decl.nameLower) ?? [];
        list.push(decl);
        declaredByName.set(decl.nameLower, list);
    }
    // Array families: a reference "v[j]" arrives as its base "v"; it is defined when members such as
    // "v1" exist. Conversely a member "v0=..." counts as used when the base "v" is referenced.
    const memberBases = new Set<string>();
    for (const decl of model.declarations) {
        const m = /^(.+?)\d+$/.exec(decl.nameLower);
        if (m) memberBases.add(m[1]);
    }
    const isDeclared = (nameLower: string) =>
        declaredByName.has(nameLower) || externalNames.has(nameLower) || memberBases.has(nameLower);
    const baseIsArrayOnly = (base: string) =>
        (declaredByName.get(base) ?? []).every(d => d.kind === 'array');

    // Line-level problems and ignored lines
    for (const info of model.lineInfos) {
        for (const p of info.problems) {
            results.push({ message: p.message, line: info.line, start: p.start, end: p.end, severity: p.severity, type: 'syntax' });
        }
        if (info.kind === 'ignored') {
            const text = model.lines[info.line];
            results.push({
                message: IGNORED_LINE_MESSAGE,
                line: info.line,
                start: text.search(/\S|$/),
                end: text.length,
                severity: 'warning',
                type: 'ignored-line',
            });
        }
    }

    // Options
    for (const opt of model.options) {
        if (opt.badSpacing) {
            results.push({
                message: `Option "${opt.name}" is ignored by XPP: no spaces are allowed around "=" on "@" lines`,
                line: opt.line, start: opt.start, end: opt.end, severity: 'error', type: 'option',
            });
        } else if (!opt.known) {
            results.push({
                message: `Unknown option "${opt.name}"`,
                line: opt.line, start: opt.start, end: opt.end, severity: 'warning', type: 'option',
            });
        }
    }

    // Keyword-like names on fixed-variable lines: "p=1" is a variable, "p a=1" a declaration
    for (const decl of model.declarations) {
        if (decl.kind === 'fixed' && !decl.fromArray && isKeywordLikeName(decl.name)) {
            results.push({
                message: `"${decl.name}" is also an XPP declaration keyword. XPP treats "${decl.name}=..." as a fixed variable ` +
                    `because "=" follows the name, but "${decl.name} x=1" would be a declaration, so this line is easy to misread.`,
                line: decl.line, start: decl.start, end: decl.end, severity: 'warning', type: 'keyword-name',
            });
        }
    }

    // References
    const used = new Set<string>();
    const reported = new Set<string>();
    for (const ref of model.references) {
        used.add(ref.nameLower);
        if (ref.role === 'init') {
            const targets = declaredByName.get(ref.nameLower) ?? [];
            const ok = targets.some(d => INIT_TARGETS.has(d.kind)) || externalNames.has(ref.nameLower);
            if (!ok && !skipUndefined) {
                results.push({
                    message: `"${ref.name}" is not a state variable, so this initial condition has no effect`,
                    line: ref.line, start: ref.start, end: ref.end, severity: 'warning', type: 'init-target',
                });
            }
            continue;
        }
        if (skipUndefined || isDeclared(ref.nameLower)) continue;
        const key = `${ref.line}:${ref.start}`;
        if (reported.has(key)) continue;
        reported.add(key);
        results.push({
            message: `"${ref.name}" is not defined`,
            line: ref.line, start: ref.start, end: ref.end, severity: 'warning', type: 'undefined',
        });
    }

    // Unused declarations
    for (const decl of model.declarations) {
        if (NEVER_UNUSED.has(decl.kind) || decl.fromArray) continue;
        if (used.has(decl.nameLower)) continue;
        const member = /^(.+?)\d+$/.exec(decl.nameLower);
        if (member && used.has(member[1]) && baseIsArrayOnly(member[1])) continue;
        results.push({
            message: `${capitalize(decl.kind)} "${decl.name}" is never used`,
            line: decl.line, start: decl.start, end: decl.end, severity: 'warning', type: 'unused', unnecessary: true,
        });
    }

    return results;
}

function capitalize(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
}
