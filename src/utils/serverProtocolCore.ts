/**
 * Pure helpers for talking to xppcore-server (the xppautX JSON front end): starting it and
 * splitting its output into protocol events. No VS Code API here so they can be unit tested.
 */
import { parseCommandLine } from './commandLineCore';

/**
 * The process to spawn for `serverCommand` on `fileName` (a name relative to the working
 * directory, which is the .ode file's folder). Undefined for an empty command.
 */
export function serverProcess(serverCommand: string, fileName: string): { executable: string; args: string[] } | undefined {
    const parsed = parseCommandLine(serverCommand);
    if (!parsed) return undefined;
    return { executable: parsed.executable, args: [...parsed.args, fileName] };
}

/**
 * Accumulates chunks of server output and returns every complete line as a parsed event. Lines
 * that are not JSON (a crash message, a stray printf) are returned in `bad` instead.
 */
export class LineSplitter {
    private pending = '';

    push(chunk: string): { events: Record<string, unknown>[]; bad: string[] } {
        this.pending += chunk;
        const events: Record<string, unknown>[] = [];
        const bad: string[] = [];
        let nl: number;
        while ((nl = this.pending.indexOf('\n')) >= 0) {
            const line = this.pending.slice(0, nl).trim();
            this.pending = this.pending.slice(nl + 1);
            if (!line) continue;
            try {
                const ev = JSON.parse(line);
                if (ev && typeof ev === 'object' && typeof ev.ev === 'string') events.push(ev);
                else bad.push(line);
            } catch {
                bad.push(line);
            }
        }
        return { events, bad };
    }
}

/** A client command as it goes to the server: one JSON object on one line. */
export function commandLine(cmd: unknown): string | undefined {
    if (!cmd || typeof cmd !== 'object' || typeof (cmd as { cmd?: unknown }).cmd !== 'string') return undefined;
    return JSON.stringify(cmd) + '\n';
}
