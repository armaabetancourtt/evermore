import type { IRProgram } from "../ir.js";
import { emitNumericWasm } from "../research/wasm.js";
import type { GeneratedFile } from "./vue.js";

export function emitWasmResearch(
  program: IRProgram,
): readonly GeneratedFile[] {
  const module = emitNumericWasm(program);

  return [
    {
      path: "evermore.wasm.json",
      content:
        JSON.stringify(
          {
            app: program.appName,
            target: "wasm-research",
            exports: module.exports,
            bytes: [...module.bytes],
          },
          null,
          2,
        ) + "\n",
    },
    {
      path: "run.mjs",
      content: [
        'import { readFile } from "node:fs/promises";',
        "",
        "const manifest = JSON.parse(",
        "  await readFile(new URL(\"./evermore.wasm.json\", import.meta.url), \"utf8\"),",
        ");",
        "const { instance } = await WebAssembly.instantiate(",
        "  Uint8Array.from(manifest.bytes),",
        ");",
        "console.log(\"Evermore WASM exports:\", Object.keys(instance.exports));",
        "",
      ].join("\n"),
    },
  ];
}
