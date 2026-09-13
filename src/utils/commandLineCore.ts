/** Splits a command line into the executable and its arguments, honouring double quotes. */
export function parseCommandLine(commandLine: string): { executable: string; args: string[] } | undefined {
    const parts: string[] = [];
    const re = /"([^"]*)"|(\S+)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(commandLine)) !== null) {
        parts.push(match[1] !== undefined ? match[1] : match[2]);
    }
    if (parts.length === 0) return undefined;
    return { executable: parts[0], args: parts.slice(1) };
}

/**
 * The TCP endpoint an X server listens on for a DISPLAY value such as "127.0.0.1:0.0", ":0" or
 * "localhost:1": port 6000 + display number. Returns undefined for values that are not TCP-shaped.
 */
export function displayEndpoint(display: string): { host: string; port: number } | undefined {
    const match = /^([^:]*):(\d+)(?:\.\d+)?$/.exec(display.trim());
    if (!match) return undefined;
    return { host: match[1] || '127.0.0.1', port: 6000 + Number(match[2]) };
}

/** True when the run command hands the work to WSL, where Windows environment variables do not apply. */
export function isWslCommand(runCommand: string): boolean {
    const executable = parseCommandLine(runCommand)?.executable ?? '';
    return /^(.*[\\/])?wsl(\.exe)?$/i.test(executable);
}
