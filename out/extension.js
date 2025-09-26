"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const diagnosticCollection = vscode.languages.createDiagnosticCollection("secureCoding");
function activate(context) {
    vscode.window.showInformationMessage("Extension activated!");
    console.log("helloji");
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((doc) => {
        vscode.window.showInformationMessage("onDidSaveTextDocument: scanDocument called");
        console.log("helloji");
        scanDocument(doc);
    }), vscode.commands.registerCommand("secureCoding.scanAndFix", () => {
        vscode.window.showInformationMessage("scanAndFix command triggered");
        console.log("helloji");
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            scanDocument(activeEditor.document);
        }
        else {
            vscode.window.showInformationMessage("No active editor found to scan.");
        }
    }), diagnosticCollection);
    // Register the fix provider
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider(["python", "javascript", "json"], new SecureCodingFixProvider(), { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }));
}
function scanDocument(document) {
    vscode.window.showInformationMessage(`scanDocument called for: ${document.fileName}`);
    const filePath = document.fileName;
    const rulesPath = `"C:\\Users\\Vivek Gautam\\OneDrive\\Desktop\\secure-vs-extensiion\\semgrep-rules"`;
    console.log("scanDocument: running semgrep...");
    (0, child_process_1.exec)(`semgrep --config=${rulesPath} "${filePath}" --json`, (error, stdout, stderr) => {
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
        }
        catch (e) {
            vscode.window.showErrorMessage(`Parsing Semgrep output failed: ${e}`);
            console.error("JSON parse error:", e);
            diagnosticCollection.set(document.uri, []);
        }
    });
}
function handleFindings(document, findings) {
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
        const diagnostics = findings.results.map((result, idx) => {
            var _a, _b, _c;
            const line = ((_b = (_a = result.start) === null || _a === void 0 ? void 0 : _a.line) !== null && _b !== void 0 ? _b : 1) - 1;
            const msg = ((_c = result.extra) === null || _c === void 0 ? void 0 : _c.message) || result.check_id || "Hardcoded secret detected";
            console.log(`handleFindings: creating diagnostic ${idx} on line ${line}: ${msg}`);
            const diagnostic = new vscode.Diagnostic(new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER), msg, vscode.DiagnosticSeverity.Error);
            diagnostic.source = "secureCoding"; // This is critical for your fix provider to detect the source correctly
            return diagnostic;
        });
        console.log("handleFindings: setting diagnostics");
        diagnosticCollection.set(document.uri, diagnostics);
        vscode.window.showInformationMessage("handleFindings: diagnostics set");
    }
    catch (err) {
        console.error("handleFindings: error", err);
        vscode.window.showErrorMessage(`handleFindings error: ${err}`);
    }
}
class SecureCodingFixProvider {
    provideCodeActions(document, range, context) {
        console.log("provideCodeActions called");
        console.log(`diagnostics count: ${context.diagnostics.length}`);
        const fixes = [];
        context.diagnostics.forEach((diagnostic, idx) => {
            console.log(`Diagnostic ${idx}: source=${diagnostic.source}, message=${diagnostic.message}`);
            if (diagnostic.source === "secureCoding") {
                const msg = diagnostic.message.toLowerCase();
                if (msg.includes("hardcoded")) {
                    console.log(`Adding fix for hardcoded-secret diagnostic ${idx}`);
                    const fix = new vscode.CodeAction("Use environment variable instead of hardcoded secret", vscode.CodeActionKind.QuickFix);
                    fix.edit = new vscode.WorkspaceEdit();
                    fix.edit.replace(document.uri, diagnostic.range, `process.env.API_KEY  /* replaced by secureCoding extension */`);
                    fix.diagnostics = [diagnostic];
                    fix.isPreferred = true;
                    fixes.push(fix);
                }
                else if (msg.includes("missing authorization")) {
                    console.log(`Adding fix for missing-auth diagnostic ${idx}`);
                    const fix = new vscode.CodeAction("Add admin authorization check", vscode.CodeActionKind.QuickFix);
                    fix.edit = new vscode.WorkspaceEdit();
                    fix.edit.insert(document.uri, new vscode.Position(diagnostic.range.end.line + 1, 0), "    if not user.is_admin:\n        raise Exception(\"Unauthorized\")\n");
                    fix.diagnostics = [diagnostic];
                    fix.isPreferred = true;
                    fixes.push(fix);
                }
                else if (msg.includes("vulnerable")) {
                    console.log(`Adding fix for vulnerable-library diagnostic ${idx}`);
                    const fix = new vscode.CodeAction("Update library to a safe version", vscode.CodeActionKind.QuickFix);
                    fix.edit = new vscode.WorkspaceEdit();
                    const line = diagnostic.range.start.line;
                    fix.edit.replace(document.uri, new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER), `  "${extractLibraryName(diagnostic.message)}": ">=2.0.0"  // updated to safe version`);
                    fix.diagnostics = [diagnostic];
                    fix.isPreferred = true;
                    fixes.push(fix);
                }
                else {
                    console.log(`Skipping diagnostic ${idx} with unmatched message content.`);
                }
            }
            else {
                console.log(`Skipping diagnostic ${idx} due to unmatched source.`);
            }
        });
        console.log(`Total fixes provided: ${fixes.length}`);
        return fixes;
    }
}
// Helper function to parse library name from diagnostic message example
function extractLibraryName(message) {
    const match = message.match(/Use of vulnerable or outdated library detected: (\S+)@/);
    return match ? match[1] : "library";
}
//# sourceMappingURL=extension.js.map