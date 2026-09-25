import process from "node:process";

import {
  diagnosticsForSource,
  documentEnd,
  formatDocument,
  renameIdentifier,
  semanticTokenLegend,
  semanticTokensForSource,
} from "./language-service.js";

type JsonRpcRequest = {
  readonly jsonrpc: "2.0";
  readonly id?: string | number;
  readonly method: string;
  readonly params?: any;
};

const documents = new Map<string, string>();
let input = Buffer.alloc(0);
const MAX_MESSAGE_BYTES = 8 * 1024 * 1024;
const MAX_HEADER_BYTES = 8192;

process.stdin.on("data", (chunk: Buffer) => {
  input = Buffer.concat([input, chunk]);
  drain();
});

process.stdin.resume();

function drain(): void {
  while (true) {
    const headerEnd = input.indexOf("\r\n\r\n");
    if (headerEnd < 0) {
      if (input.length > MAX_HEADER_BYTES) {
        input = Buffer.alloc(0);
        sendError(null, -32700, "LSP header exceeds maximum size.");
      }
      return;
    }
    if (headerEnd > MAX_HEADER_BYTES) {
      input = input.subarray(headerEnd + 4);
      sendError(null, -32700, "LSP header exceeds maximum size.");
      continue;
    }

    const header = input.subarray(0, headerEnd).toString("utf8");
    const match = /Content-Length:\s*(\d+)/i.exec(header);
    if (!match) {
      input = input.subarray(headerEnd + 4);
      continue;
    }

    const length = Number(match[1]);
    const bodyStart = headerEnd + 4;
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_MESSAGE_BYTES) {
      input = Buffer.alloc(0);
      sendError(null, -32700, "Invalid or oversized Content-Length.");
      return;
    }
    if (input.length < bodyStart + length) return;

    const body = input.subarray(bodyStart, bodyStart + length).toString("utf8");
    input = input.subarray(bodyStart + length);

    let request: JsonRpcRequest;
    try {
      request = JSON.parse(body) as JsonRpcRequest;
    } catch {
      sendError(null, -32700, "Invalid JSON payload.");
      continue;
    }

    if (!request || request.jsonrpc !== "2.0" || typeof request.method !== "string") {
      sendError(null, -32600, "Invalid JSON-RPC request.");
      continue;
    }
    try {
      handle(request);
    } catch (error) {
      if (request.id !== undefined) {
        sendError(request.id, -32603, error instanceof Error ? error.message : "Internal error.");
      }
    }
  }
}

function handle(request: JsonRpcRequest): void {
  const params = request.params ?? {};

  switch (request.method) {
    case "initialize":
      respond(request.id, {
        capabilities: {
          textDocumentSync: 1,
          documentFormattingProvider: true,
          renameProvider: true,
          semanticTokensProvider: {
            legend: {
              tokenTypes: [...semanticTokenLegend],
              tokenModifiers: [],
            },
            full: true,
          },
        },
        serverInfo: {
          name: "evermore-language-server",
          version: "0.8.0",
        },
      });
      return;

    case "initialized":
      return;

    case "shutdown":
      respond(request.id, null);
      return;

    case "exit":
      process.exit(0);
      return;

    case "textDocument/didOpen": {
      const uri = params.textDocument?.uri as string;
      const text = params.textDocument?.text as string;
      documents.set(uri, text);
      publishDiagnostics(uri, text);
      return;
    }

    case "textDocument/didChange": {
      const uri = params.textDocument?.uri as string;
      const text = params.contentChanges?.at(-1)?.text as string | undefined;
      if (text !== undefined) {
        documents.set(uri, text);
        publishDiagnostics(uri, text);
      }
      return;
    }

    case "textDocument/didClose": {
      const uri = params.textDocument?.uri as string;
      documents.delete(uri);
      notify("textDocument/publishDiagnostics", { uri, diagnostics: [] });
      return;
    }

    case "textDocument/formatting": {
      const uri = params.textDocument?.uri as string;
      const text = documents.get(uri) ?? "";
      const formatted = formatDocument(text);
      respond(request.id, [
        {
          range: {
            start: { line: 0, character: 0 },
            end: documentEnd(text),
          },
          newText: formatted,
        },
      ]);
      return;
    }

    case "textDocument/rename": {
      const uri = params.textDocument?.uri as string;
      const text = documents.get(uri) ?? "";
      const edits = renameIdentifier(text, params.position, params.newName);
      respond(request.id, { changes: { [uri]: edits } });
      return;
    }

    case "textDocument/semanticTokens/full": {
      const uri = params.textDocument?.uri as string;
      const text = documents.get(uri) ?? "";
      respond(request.id, { data: semanticTokensForSource(text) });
      return;
    }

    default:
      if (request.id !== undefined) {
        send({
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32601,
            message: "Method not found: " + request.method,
          },
        });
      }
  }
}

function publishDiagnostics(uri: string, text: string): void {
  try {
    notify("textDocument/publishDiagnostics", {
      uri,
      diagnostics: diagnosticsForSource(text),
    });
  } catch (error) {
    notify("textDocument/publishDiagnostics", {
      uri,
      diagnostics: [{
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        severity: 1,
        source: "evermore",
        code: "E9000",
        message: error instanceof Error ? error.message : "Internal language service error.",
      }],
    });
  }
}

function sendError(id: string | number | null, code: number, message: string): void {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function respond(id: string | number | undefined, result: unknown): void {
  if (id === undefined) return;
  send({ jsonrpc: "2.0", id, result });
}

function notify(method: string, params: unknown): void {
  send({ jsonrpc: "2.0", method, params });
}

function send(payload: unknown): void {
  const body = JSON.stringify(payload);
  process.stdout.write(
    "Content-Length: " + Buffer.byteLength(body, "utf8") + "\r\n\r\n" + body,
  );
}
