import * as vscode from 'vscode';

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection('xpp');
    context.subscriptions.push(diagnosticCollection);

    // Check all open text documents when the extension is activated
    vscode.workspace.textDocuments.forEach(document => {
        checkFile(document);
    });

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(document => {
            checkFile(document);
        }),
        vscode.workspace.onDidCreateFiles(event => {
            event.files.forEach(file => {
                addDirectiveToFile(file);
            });
        }),
        vscode.workspace.onDidOpenTextDocument(document => {
            checkFile(document);
        }),
        vscode.workspace.onDidChangeTextDocument(event => {
            checkFile(event.document);
        }),
        vscode.commands.registerCommand('extension.toggleComment', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                toggleComment(editor);
            }
        })
    );
}

function checkFile(document: vscode.TextDocument) {
    const fileName = document.fileName;
    const text = document.getText();
    const lines = text.split('\n').map(line => line.trim());
    const lastNonEmptyLine = lines.reverse().find(line => line !== '');

    let diagnostics: vscode.Diagnostic[] = [];

    // Check for missing end directives
    if (fileName.endsWith('.ode') && lastNonEmptyLine !== 'done') {
        const range = new vscode.Range(document.lineCount - 1, 0, document.lineCount - 1, lastNonEmptyLine?.length || 0);
        const diagnostic = new vscode.Diagnostic(range, 'Missing done at the end of the .ode file', vscode.DiagnosticSeverity.Error);
        diagnostics.push(diagnostic);
    } else if (fileName.endsWith('.inc') && lastNonEmptyLine !== '#done') {
        const range = new vscode.Range(document.lineCount - 1, 0, document.lineCount - 1, lastNonEmptyLine?.length || 0);
        const diagnostic = new vscode.Diagnostic(range, 'Missing #done at the end of the .inc file', vscode.DiagnosticSeverity.Error);
        diagnostics.push(diagnostic);
    }

    // Check for balanced parentheses
    const stack: { char: string, line: number, charIndex: number }[] = [];
    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i).text;
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '(' || char === '{' || char === '[') {
                stack.push({ char, line: i, charIndex: j });
            } else if (char === ')' || char === '}' || char === ']') {
                const last = stack.pop();
                if (!last || !isMatchingPair(last.char, char)) {
                    const range = new vscode.Range(i, j, i, j + 1);
                    const diagnostic = new vscode.Diagnostic(range, `Unmatched closing parenthesis: ${char}`, vscode.DiagnosticSeverity.Error);
                    diagnostics.push(diagnostic);
                }
            }
        }
    }

    // Check for any unmatched opening parentheses left in the stack
    while (stack.length > 0) {
        const unmatched = stack.pop();
        if (unmatched) {
            const range = new vscode.Range(unmatched.line, unmatched.charIndex, unmatched.line, unmatched.charIndex + 1);
            const diagnostic = new vscode.Diagnostic(range, `Unmatched opening parenthesis: ${unmatched.char}`, vscode.DiagnosticSeverity.Error);
            diagnostics.push(diagnostic);
        }
    }

    // Check for unpreceded 'include'
    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i).text;
        if (!line.startsWith('#')) {
            const match = line.match(/\binclude\b/);
            if (match) {
                const range = new vscode.Range(i, match.index || 0, i, (match.index || 0) + 7);
                const diagnostic = new vscode.Diagnostic(range, 'Unpreceded "include" found', vscode.DiagnosticSeverity.Error);
                diagnostics.push(diagnostic);
            }
        }
    }

    diagnosticCollection.set(document.uri, diagnostics);
}

function isMatchingPair(open: string, close: string): boolean {
    return (open === '(' && close === ')') || (open === '{' && close === '}') || (open === '[' && close === ']');
}

function addDirectiveToFile(file: vscode.Uri) {
    const fileName = file.fsPath;
    const edit = new vscode.WorkspaceEdit();

    if (fileName.endsWith('.ode')) {
        edit.insert(file, new vscode.Position(0, 0), 'done\n');
    } else if (fileName.endsWith('.inc')) {
        edit.insert(file, new vscode.Position(0, 0), '#done\n');
    }

    vscode.workspace.applyEdit(edit);
}

function toggleComment(editor: vscode.TextEditor) {
    const document = editor.document;
    const edit = new vscode.WorkspaceEdit();

    editor.selections.forEach(selection => {
        for (let i = selection.start.line; i <= selection.end.line; i++) {
            const line = document.lineAt(i);
            const text = line.text.trim();

            if (text.startsWith('# #include') || text.startsWith('# #done')) {
                // Uncomment specific cases
                const newText = text.replace('# #', '#');
                edit.replace(document.uri, line.range, newText);
            } else if (text.startsWith('#include') || text.startsWith('#done')) {
                // Comment specific cases
                const newText = `# ${text}`;
                edit.replace(document.uri, line.range, newText);
            } else if (text.startsWith('#')) {
                // Uncomment general cases
                const newText = text.replace(/^#\s*/, '');
                edit.replace(document.uri, line.range, newText);
            } else {
                // Comment other lines
                const newText = `# ${text}`;
                edit.replace(document.uri, line.range, newText);
            }
        }
    });

    vscode.workspace.applyEdit(edit);
}

export function deactivate() {
    if (diagnosticCollection) {
        diagnosticCollection.dispose();
    }
}
