import * as fs from 'fs';
import * as path from 'path';
import { parseXpp } from './xppModel';

/**
 * The files named on "#include" lines, resolved against the including file's folder, and the
 * files those include in turn (the whole tree, each file once, depth first). The file itself is
 * never in the result, so a cycle ends. A missing file is skipped: XPP itself will complain
 * about it.
 */
export function readIncludedFiles(documentPath: string, includes: { path: string }[]): { path: string; text: string }[] {
    const seen = new Set<string>([path.resolve(documentPath)]);
    const found: { path: string; text: string }[] = [];
    const visit = (fromPath: string, list: { path: string }[]) => {
        for (const include of list) {
            const includedPath = path.resolve(path.dirname(fromPath), include.path);
            if (seen.has(includedPath)) continue;
            seen.add(includedPath);
            let text: string;
            try {
                text = fs.readFileSync(includedPath, 'utf8');
            } catch {
                continue;
            }
            found.push({ path: includedPath, text });
            visit(includedPath, parseXpp(text).includes);
        }
    };
    visit(documentPath, includes);
    return found;
}
