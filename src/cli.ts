#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  compilePackage,
  compileProject,
  type CompileTarget,
} from "./compiler.js";
import {
  EvermoreDiagnosticError,
  formatDiagnostic,
} from "./diagnostics.js";
import { formatSource, type FormatStyle } from "./formatter.js";
import { parse } from "./parser.js";
import { loadPackageProject } from "./package.js";
import { loadProject } from "./project.js";
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
  const packageInput =
    path.basename(absoluteSource) === "evermore.json";

  switch (command) {
    case "check": {
      const readSource = (filePath: string) =>
        readFile(filePath, "utf8");

      if (packageInput) {
        const project = await loadPackageProject(
          absoluteSource,
          readSource,
        );
        const analysis = analyze(project.program);

        for (const diagnostic of analysis.diagnostics) {
          console.log(formatDiagnostic(diagnostic, sourcePath));
        }

        if (!analysis.model) process.exitCode = 1;
        else {
          console.log(
            "✓ package " +
              project.rootPackage.manifest.name +
              "@" +
              project.rootPackage.manifest.version +
              " is semantically valid across " +
              project.packages.length +
              " package(s) and " +
              project.units.length +
              " source file(s).",
          );
        }
        return;
      }

      const project = await loadProject(
        absoluteSource,
        readSource,
      );
      const analysis = analyze(project.program);

      for (const diagnostic of analysis.diagnostics) {
        console.log(formatDiagnostic(diagnostic, sourcePath));
      }

      if (!analysis.model) process.exitCode = 1;
      else {
        console.log(
          "✓ " +
            project.program.appName +
            " is semantically valid across " +
            project.units.length +
            " source file(s).",
        );
      }
      return;
    }

    case "ast": {
      if (packageInput) {
        throw new Error(
          "ast expects an Evermore source file, not evermore.json.",
        );
      }
      const source = await readFile(absoluteSource, "utf8");
      console.log(JSON.stringify(parse(source), null, 2));
      return;
    }

    case "format": {
      if (packageInput) {
        throw new Error(
          "format expects an Evermore source file, not evermore.json.",
        );
      }
      const source = await readFile(absoluteSource, "utf8");
      const style = readFormatStyle(rest);
      const formatted = formatSource(source, style);

      if (rest.includes("--write")) {
        await writeFile(absoluteSource, formatted, "utf8");
        console.log("✓ Formatted " + sourcePath + " using " + style + " style.");
      } else {
        process.stdout.write(formatted);
      }

      return;
    }

    case "build": {
      const out = readOption(rest, "--out") ?? "evermore-build";
      const target = readTarget(rest);
      const readSource = (filePath: string) =>
        readFile(filePath, "utf8");
      const result = packageInput
        ? await compilePackage(
            absoluteSource,
            readSource,
            { target },
          )
        : await compileProject(
            absoluteSource,
            readSource,
            { target },
          );

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

function readTarget(args: readonly string[]): CompileTarget {
  const value = readOption(args, "--target") ?? "vue";
  if (
    value === "vue" ||
    value === "node" ||
    value === "ai" ||
    value === "react-native" ||
    value === "flutter"
  ) {
    return value;
  }

  throw new Error(
    'Unknown target "' +
      value +
      '". Use vue, node, ai, react-native, or flutter.',
  );
}

function readFormatStyle(args: readonly string[]): FormatStyle {
  const value = readOption(args, "--style") ?? "natural";

  if (value === "natural" || value === "explicit") {
    return value;
  }

  throw new Error(
    'Unknown format style "' + value + '". Use natural or explicit.',
  );
}

function readOption(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function printHelp(): void {
  console.log(
    [
      "Evermore compiler",
      "",
      "Usage:",
      "  evermore check <entry.ever|evermore.json>",
      "  evermore ast <file.ever>",
      "  evermore format <file.ever> [--style natural|explicit] [--write]",
      "  evermore build <entry.ever|evermore.json> [--target vue|node|ai|react-native|flutter] [--out directory]",
      "",
      "",
      "Modules:",
      '  entry files start with app "Name"',
      "  imported files start with module Name",
      '  import "./relative-module.ever"',
      "",
      "Packages:",
      "  evermore.json declares name, exact version, entry, and local dependencies",
      '  package import example: import "shared/models"',
      "",
      "Current backends:",
      "  vue     Vue 3 + Vite application generation",
      "  node    Typed Node.js HTTP server generation",
      "  ai           Provider-neutral agent runtime + deterministic evaluation harness",
      "  react-native React Native mobile application generation",
      "  flutter      Flutter backend experiment",
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
