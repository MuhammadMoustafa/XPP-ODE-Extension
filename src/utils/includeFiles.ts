import * as fs from 'fs';
import * as path from 'path';

/**
 * The files named on "#include" lines, resolved against the including file's folder.
 * A missing file is skipped: XPP itself will complain about it.
 */
export function readIncludedFiles(documentPath: string, includes: { path: string }[]): { path: string; text: string }[] {
    return includes.flatMap(include => {
        const includedPath = path.resolve(path.dirname(documentPath), include.path);
        try {
            return [{ path: includedPath, text: fs.readFileSync(includedPath, 'utf8') }];
        } catch {
            return [];
        }
    });
}
