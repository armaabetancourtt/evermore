#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { compile } from "./compiler.js";
import {
  EvermoreDiagnosticError,
  formatDiagnostic,
} from "./diagnostics.js";
import { parse } from "./parser.js";
import { analyze } from "./semantic.js";

async function main(): Promise<void> {
  const [command, sourcePath, ...rest] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (!sourcePath) {
    throw new Error("Expected an Evermore source file.");
  }

  const absoluteSource = path.resolve(sourcePath);
  const source = await readFile(absoluteSource, "utf8");

  switch (command) {
    case "check": {
      const program = parse(source);
      const analysis = analyze(program);

      for (const diagnostic of analysis.diagnostics) {
        console.log(formatDiagnostic(diagnostic, sourcePath));
      }

      if (!analysis.model) process.exitCode = 1;
      else console.log("✓ " + program.appName + " is semantically valid.");
      return;
    }

    case "ast": {
      console.log(JSON.stringify(parse(source), null, 2));
      return;
    }

    case "build": {
      const out = readOption(rest, "--out") ?? "evermore-build";
      const result = compile(source, { target: "vue" });

      for (const diagnostic of result.diagnostics) {
        console.log(formatDiagnostic(diagnostic, sourcePath));
      }

      for (const file of result.files) {
        const destination = path.resolve(out, file.path);
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, file.content, "utf8");
      }

      console.log(
        "✓ Built " +
          result.appName +
          " for " +
          result.target +
          " (" +
          result.files.length +
          " files).",
      );
      console.log("  Output: " + path.resolve(out));
      return;
    }

    default:
      throw new Error(
        'Unknown command "' + command + '". Run evermore --help.',
      );
  }
}

function readOption(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function printHelp(): void {
  console.log(
    [
      "Evermore compiler foundation",
      "",
      "Usage:",
      "  evermore check <file.ever>",
      "  evermore ast <file.ever>",
      "  evermore build <file.ever> [--out directory]",
      "",
      "Current backend:",
      "  vue    Prototype Vue 3 code generation",
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  if (error instanceof EvermoreDiagnosticError) {
    for (const diagnostic of error.diagnostics) {
      console.error(formatDiagnostic(diagnostic));
    }
    process.exitCode = 1;
    return;
  }

  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
