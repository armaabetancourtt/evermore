import { spawn } from "node:child_process";
import { lstat, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const excludedDirectories = new Set([".git", ".evermore-build", "dist", "node_modules"]);

function missing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === "ENOENT";
}

async function pathStat(filePath: string) {
  try {
    return await lstat(filePath);
  } catch (error) {
    if (missing(error)) return undefined;
    throw error;
  }
}

/** Initialize a small, compilable, typed Evermore package without overwriting files. */
export async function initializeProject(directory: string): Promise<string> {
  const root = path.resolve(directory);
  const existing = await pathStat(root);
  if (existing && (!existing.isDirectory() || existing.isSymbolicLink())) {
    throw new Error("Project destination must be a directory, not a file or symlink.");
  }
  if (existing && (await readdir(root)).length > 0) {
    throw new Error("Project destination is not empty: " + root);
  }

  const name = path.basename(root).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "evermore-app";
  const displayName = path.basename(root).replace(/["\\\r\n]/g, " ").trim() || "Evermore App";
  await mkdir(root, { recursive: true });
  const manifest = {
    name,
    version: "0.1.0",
    entry: "main.ever",
    dependencies: {},
  };
  await writeFile(path.join(root, "evermore.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
  await writeFile(path.join(root, "main.ever"), [
    "app " + JSON.stringify(displayName),
    "",
    "screen Home",
    "  title " + JSON.stringify(displayName),
    "  text \"Made with Evermore.\"",
    "  button \"Continue\"",
    "    opens About",
    "",
    "screen About",
    "  title \"Your first Evermore app\"",
    "  text \"Build what you imagine.\"",
    "",
  ].join("\n"), { flag: "wx" });
  await writeFile(path.join(root, ".gitignore"), ".evermore-build/\nnode_modules/\n", { flag: "wx" });
  return root;
}

/** Find independently checkable app files and package manifests, without following symlinks. */
export async function discoverTestEntries(input: string): Promise<readonly string[]> {
  const root = path.resolve(input);
  const initial = await pathStat(root);
  if (!initial || initial.isSymbolicLink()) throw new Error("Test path does not exist or is a symlink: " + root);
  if (initial.isFile()) {
    if (path.extname(root) !== ".ever" && path.basename(root) !== "evermore.json") {
      throw new Error("Expected an .ever file, evermore.json, or a directory.");
    }
    return [root];
  }
  if (!initial.isDirectory()) throw new Error("Test path must be a file or directory.");

  const entries: string[] = [];
  async function visit(directory: string): Promise<void> {
    const children = (await readdir(directory, { withFileTypes: true }))
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
    const manifest = children.find((item) => item.name === "evermore.json" && item.isFile());
    // A package is checked via its manifest; its source modules are not standalone apps.
    if (manifest) {
      entries.push(path.join(directory, manifest.name));
      return;
    }
    for (const child of children) {
      if (child.isSymbolicLink()) continue;
      const candidate = path.join(directory, child.name);
      if (child.isDirectory() && !excludedDirectories.has(child.name)) {
        await visit(candidate);
      } else if (child.isFile() && child.name.endsWith(".ever")) {
        entries.push(candidate);
      }
    }
  }
  await visit(root);
  return entries;
}

/** Reject preexisting symlink components before writing generated artifacts. */
export async function prepareGeneratedDestination(root: string, destination: string): Promise<void> {
  const absoluteRoot = path.resolve(root);
  const absoluteDestination = path.resolve(destination);
  const relative = path.relative(absoluteRoot, absoluteDestination);
  if (!relative || relative.startsWith(".." + path.sep) || relative === ".." || path.isAbsolute(relative)) {
    throw new Error("Generated output escapes the build directory.");
  }
  await mkdir(absoluteRoot, { recursive: true });
  let current = absoluteRoot;
  for (const segment of relative.split(path.sep).slice(0, -1)) {
    current = path.join(current, segment);
    const stat = await pathStat(current);
    if (stat?.isSymbolicLink() || (stat && !stat.isDirectory())) {
      throw new Error("Unsafe generated output parent: " + current);
    }
    if (!stat) await mkdir(current);
  }
  const leaf = await pathStat(absoluteDestination);
  if (leaf?.isSymbolicLink() || (leaf && !leaf.isFile())) {
    throw new Error("Unsafe generated output file: " + absoluteDestination);
  }
}

function spawnCommand(command: string, args: readonly string[], directory: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.platform === "win32" ? command + ".cmd" : command, [...args], {
      cwd: directory,
      stdio: "inherit",
      shell: false,
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (signal) reject(new Error(command + " terminated by signal " + signal));
      else resolve(code ?? 1);
    });
  });
}

/** Build output is a normal Vite project: install when needed, then delegate to its dev server. */
export async function runGeneratedWeb(directory: string, allowInstall: boolean): Promise<number> {
  const absolute = path.resolve(directory);
  if (!(await pathStat(path.join(absolute, "node_modules")))) {
    if (!allowInstall) {
      throw new Error("Generated dependencies are missing. Run again without --no-install.");
    }
    const installed = await spawnCommand("npm", ["install", "--no-audit", "--no-fund"], absolute);
    if (installed !== 0) return installed;
  }
  return spawnCommand("npm", ["run", "dev", "--", "--host", "127.0.0.1"], absolute);
}
