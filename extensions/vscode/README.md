# Evermore VS Code extension scaffold

Local-development client for the existing stdio LSP server. Build the root compiler first (`npm run build`); configure `evermore.serverPath` to the absolute path of the compiled `dist/src/tooling/lsp-server.js`. In this directory run `npm install && npm run build` and launch with VS Code Extension Development Host.

This scaffold has not been published or verified in the VS Code marketplace. LSP framing and actual editor integration need manual/end-to-end tests.
