import * as vscode from "vscode";
import { LanguageClient, TransportKind } from "vscode-languageclient/node";
let client: LanguageClient | undefined;
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const configured = vscode.workspace.getConfiguration("evermore").get<string>("serverPath");
  if (!configured) {
    void vscode.window.showWarningMessage("Configure evermore.serverPath to the built LSP server.");
    return;
  }
  const server = {run:{command:process.execPath,args:[configured],transport:TransportKind.stdio},
    debug:{command:process.execPath,args:[configured],transport:TransportKind.stdio}};
  client = new LanguageClient("evermore","Evermore Language Server",server,{
    documentSelector:[{scheme:"file",language:"evermore"}]});
  context.subscriptions.push(client);
  await client.start();
}
export async function deactivate(): Promise<void> { if(client) await client.stop(); }
