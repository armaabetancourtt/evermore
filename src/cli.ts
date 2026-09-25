#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
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
import { resolveGeneratedPath } from "./output-path.js";
import {
  discoverTestEntries,
  initializeProject,
  prepareGeneratedDestination,
  runGeneratedWeb,
} from "./beta-cli.js";

async function main(): Promise<void> {
  const [command, sourcePath, ...rest] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "init") {
    if (rest.length > 0) throw new Error("Usage: evermore init [directory]");
    const destination = await initializeProject(sourcePath ?? "evermore-app");
    console.log("✓ Created Evermore project at " + destination);
    console.log("  Next: evermore check " + path.join(destination, "evermore.json"));
    return;
  }

  if (!sourcePath) {
    throw new Error("Expected an Evermore source file or package manifest.");
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

    case "test": {
      if (rest.length > 0) throw new Error("Usage: evermore test <entry.ever|evermore.json|directory>");
      const entries = await discoverTestEntries(absoluteSource);
      if (entries.length === 0) throw new Error("No .ever files or manifests found.");
      const readSource = (filePath: string) => readFile(filePath, "utf8");
      let passed = 0;
      let failed = 0;
      let skipped = 0;
      for (const entry of entries) {
        try {
          if (path.basename(entry) !== "evermore.json") {
            const unit = parse(await readSource(entry));
            if (unit.unitKind === "module") {
              skipped += 1;
              continue;
            }
          }
          const project = path.basename(entry) === "evermore.json"
            ? await loadPackageProject(entry, readSource)
            : await loadProject(entry, readSource);
          const analysis = analyze(project.program);
          const errors = analysis.diagnostics.filter((item) => item.severity === "error");
          if (errors.length > 0 || !analysis.model) {
            failed += 1;
            for (const diagnostic of errors) console.error(formatDiagnostic(diagnostic, entry));
            continue;
          }
          passed += 1;
          console.log("✓ " + path.relative(process.cwd(), entry));
        } catch (error) {
          failed += 1;
          if (error instanceof EvermoreDiagnosticError) {
            for (const diagnostic of error.diagnostics) console.error(formatDiagnostic(diagnostic, entry));
          } else {
            console.error(entry + ": " + (error instanceof Error ? error.message : String(error)));
          }
        }
      }
      console.log("Evermore: " + passed + " passed, " + failed + " failed, " + skipped + " modules skipped.");
      if (failed > 0 || passed === 0) process.exitCode = 1;
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

      if (rest.includes("--write") && rest.includes("--check")) {
        throw new Error("Choose either --write or --check.");
      }
      if (rest.includes("--check")) {
        if (formatted !== source) {
          console.error("✗ " + sourcePath + " is not formatted (" + style + ").");
          process.exitCode = 1;
        } else {
          console.log("✓ " + sourcePath + " is formatted.");
        }
      } else if (rest.includes("--write")) {
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
        const destination = resolveGeneratedPath(out, file.path);
        await prepareGeneratedDestination(out, destination);
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

    case "run": {
      if (rest.some((argument) => argument !== "--no-install" && argument !== "--help")) {
        throw new Error("Usage: evermore run <entry.ever|evermore.json> [--no-install]");
      }
      const out = path.resolve(".evermore-build", "vue");
      const readSource = (filePath: string) => readFile(filePath, "utf8");
      const result = packageInput
        ? await compilePackage(absoluteSource, readSource, { target: "vue" })
        : await compileProject(absoluteSource, readSource, { target: "vue" });
      for (const file of result.files) {
        const destination = resolveGeneratedPath(out, file.path);
        await prepareGeneratedDestination(out, destination);
        await writeFile(destination, file.content, "utf8");
      }
      console.log("✓ Starting " + result.appName + " at http://127.0.0.1:5173");
      const code = await runGeneratedWeb(out, !rest.includes("--no-install"));
      if (code !== 0) process.exitCode = code;
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
    value === "flutter" ||
    value === "python" ||
    value === "infra" ||
    value === "wasm"
  ) {
    return value;
  }

  throw new Error(
    'Unknown target "' +
      value +
      '". Use vue, node, ai, react-native, flutter, python, infra, or wasm.',
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
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error("Expected a value after " + name + ".");
  return value;
}

function printHelp(): void {
  console.log(
    [
      "Evermore compiler",
      "",
      "Usage:",
      "  evermore init [directory]",
      "  evermore check <entry.ever|evermore.json>",
      "  evermore test <entry.ever|evermore.json|directory> (semantic checks)",
      "  evermore ast <file.ever>",
      "  evermore format <file.ever> [--style natural|explicit] [--write|--check]",
      "  evermore run <entry.ever|evermore.json> [--no-install] (Vue/Vite)",
      "  evermore build <entry.ever|evermore.json> [--target vue|node|ai|react-native|flutter|python|infra|wasm] [--out directory]",
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
      "  python       Typed Python data/scientific pipeline generation",
      "  infra        Docker + Kubernetes deployment plan generation",
      "  wasm         Experimental numeric WebAssembly generation",
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
