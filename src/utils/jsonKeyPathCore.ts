/**
 * Where the cursor is in a JSON document, for completion of property names.
 */

interface Frame {
    isObject: boolean;
    /** Name of the property whose value this object or array is ('' at the top level). */
    key: string;
    /** Name of the property being given a value in this object, between its ":" and the next ",". */
    valueOf: string | undefined;
}

/**
 * When `textBefore` (the document up to the cursor) ends where a property name goes, possibly
 * inside its opening quote, returns the names of the properties enclosing that position, outermost
 * first: `[]` at the top level, `["variables"]` inside `{ "variables": { | } }`. Otherwise undefined.
 */
export function keyPathAt(textBefore: string): string[] | undefined {
    const stack: Frame[] = [];
    let lastString = '';
    let stringStart = -1;
    for (let i = 0; i < textBefore.length; i++) {
        const ch = textBefore[i];
        if (stringStart >= 0) {
            if (ch === '\\') i++;
            else if (ch === '"') {
                lastString = textBefore.substring(stringStart + 1, i);
                stringStart = -1;
            }
            continue;
        }
        const top = stack[stack.length - 1];
        if (ch === '"') stringStart = i;
        else if (ch === ':' && top?.isObject) top.valueOf = lastString;
        else if (ch === ',' && top) top.valueOf = undefined;
        else if (ch === '{' || ch === '[') stack.push({ isObject: ch === '{', key: top?.valueOf ?? '', valueOf: undefined });
        else if (ch === '}' || ch === ']') stack.pop();
    }
    const top = stack[stack.length - 1];
    if (!top?.isObject || top.valueOf !== undefined) return undefined;
    return stack.slice(1).map(frame => frame.key);
}
