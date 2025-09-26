import * as vscode from "vscode";
import { exec } from "child_process";

const diagnosticCollection = vscode.languages.createDiagnosticCollection("secureCoding");

export function activate(context: vscode.ExtensionContext) {
  vscode.window.showInformationMessage("Extension activated!");
  console.log("helloji");

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      vscode.window.showInformationMessage("onDidSaveTextDocument: scanDocument called");
      console.log("helloji");
      scanDocument(doc);
    }),
    vscode.commands.registerCommand("secureCoding.scanAndFix", () => {
      vscode.window.showInformationMessage("scanAndFix command triggered");
      console.log("helloji");
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        scanDocument(activeEditor.document);
      } else {
        vscode.window.showInformationMessage("No active editor found to scan.");
      }
    }),
    diagnosticCollection
  );

  // Register the fix provider
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      ["python", "javascript", "json"],
      new SecureCodingFixProvider(),
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
    )
  );
}

function scanDocument(document: vscode.TextDocument): void {
  vscode.window.showInformationMessage(`scanDocument called for: ${document.fileName}`);
  const filePath = document.fileName;
  const rulesPath = `"C:\\Users\\Vivek Gautam\\OneDrive\\Desktop\\secure-vs-extensiion\\semgrep-rules"`;
  console.log("scanDocument: running semgrep...");

  exec(
    `semgrep --config=${rulesPath} "${filePath}" --json`,
    (error, stdout, stderr) => {
      vscode.window.showInformationMessage("semgrep exec finished");
      console.log("scanDocument: semgrep stdout length:", stdout.length);
      console.log("scanDocument: semgrep stderr length:", stderr.length);

      if (error && !stderr.includes("(ca-certs)")) {
        vscode.window.showErrorMessage(`Semgrep failed: ${stderr}`);
        diagnosticCollection.set(document.uri, []);
        return;
      }
      try {
        vscode.window.showInformationMessage("parsing semgrep output...");
        const findings = JSON.parse(stdout);
        console.log("scanDocument: JSON parsed, findings keys:", Object.keys(findings));
        vscode.window.showInformationMessage("parsed findings, calling handleFindings");
        handleFindings(document, findings);
      } catch (e) {
        vscode.window.showErrorMessage(`Parsing Semgrep output failed: ${e}`);
        console.error("JSON parse error:", e);
        diagnosticCollection.set(document.uri, []);
      }
    }
  );
}

function handleFindings(document: vscode.TextDocument, findings: any): void {
  console.log("handleFindings: enter function");
  try {
    const preview = JSON.stringify(findings).slice(0, 500);
    console.log("handleFindings: findings preview:", preview);
    vscode.window.showInformationMessage(`handleFindings entered with findings: ${preview}`);

    if (!findings || !Array.isArray(findings.results)) {
      console.log("handleFindings: findings.results missing or not array:", findings.results);
      vscode.window.showWarningMessage("handleFindings: No or invalid findings.results");
      diagnosticCollection.set(document.uri, []);
      return;
    }

    vscode.window.showInformationMessage(`handleFindings: findings.results length ${findings.results.length}`);
    console.log("handleFindings: number of results:", findings.results.length);

    const diagnostics: vscode.Diagnostic[] = findings.results.map((result: any, idx: number) => {
      const line = (result.start?.line ?? 1) - 1;
      const msg = result.extra?.message || result.check_id || "Hardcoded secret detected";
      console.log(`handleFindings: creating diagnostic ${idx} on line ${line}: ${msg}`);
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER),
        msg,
        vscode.DiagnosticSeverity.Error
      );
      diagnostic.source = "secureCoding"; // This is critical for your fix provider to detect the source correctly
      return diagnostic;
    });

    console.log("handleFindings: setting diagnostics");
    diagnosticCollection.set(document.uri, diagnostics);
    vscode.window.showInformationMessage("handleFindings: diagnostics set");
  } catch (err) {
    console.error("handleFindings: error", err);
    vscode.window.showErrorMessage(`handleFindings error: ${err}`);
  }
}

class SecureCodingFixProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    console.log("provideCodeActions called");
    console.log(`diagnostics count: ${context.diagnostics.length}`);

    const fixes: vscode.CodeAction[] = [];

    context.diagnostics.forEach((diagnostic, idx) => {
      console.log(`Diagnostic ${idx}: source=${diagnostic.source}, message=${diagnostic.message}`);

      if (diagnostic.source === "secureCoding") {
        const msg = diagnostic.message.toLowerCase();

        if (msg.includes("hardcoded")) {
          console.log(`Adding fix for hardcoded-secret diagnostic ${idx}`);
          const fix = new vscode.CodeAction(
            "Use environment variable instead of hardcoded secret",
            vscode.CodeActionKind.QuickFix
          );
          fix.edit = new vscode.WorkspaceEdit();
          fix.edit.replace(document.uri, diagnostic.range, `process.env.API_KEY  /* replaced by secureCoding extension */`);
          fix.diagnostics = [diagnostic];
          fix.isPreferred = true;
          fixes.push(fix);

        } else if (msg.includes("missing authorization")) {
          console.log(`Adding fix for missing-auth diagnostic ${idx}`);
          const fix = new vscode.CodeAction(
            "Add admin authorization check",
            vscode.CodeActionKind.QuickFix
          );
          fix.edit = new vscode.WorkspaceEdit();
          fix.edit.insert(document.uri, new vscode.Position(diagnostic.range.end.line + 1, 0),
            "    if not user.is_admin:\n        raise Exception(\"Unauthorized\")\n");
          fix.diagnostics = [diagnostic];
          fix.isPreferred = true;
          fixes.push(fix);

        } else if (msg.includes("vulnerable")) {
          console.log(`Adding fix for vulnerable-library diagnostic ${idx}`);
          const fix = new vscode.CodeAction(
            "Update library to a safe version",
            vscode.CodeActionKind.QuickFix
          );
          fix.edit = new vscode.WorkspaceEdit();
          const line = diagnostic.range.start.line;
          fix.edit.replace(document.uri, new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER),
            `  "${extractLibraryName(diagnostic.message)}": ">=2.0.0"  // updated to safe version`);
          fix.diagnostics = [diagnostic];
          fix.isPreferred = true;
          fixes.push(fix);
        } else {
          console.log(`Skipping diagnostic ${idx} with unmatched message content.`);
        }
      } else {
        console.log(`Skipping diagnostic ${idx} due to unmatched source.`);
      }
    });

    console.log(`Total fixes provided: ${fixes.length}`);
    return fixes;
  }
}

// Helper function to parse library name from diagnostic message example
function extractLibraryName(message: string): string {
  const match = message.match(/Use of vulnerable or outdated library detected: (\S+)@/);
  return match ? match[1] : "library";
}


