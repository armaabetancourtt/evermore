import path from "node:path";

/** Resolve a generated file without allowing it to escape the output directory. */
export function resolveGeneratedPath(outputDirectory: string, generatedPath: string): string {
  if (
    !generatedPath ||
    generatedPath.includes("\u0000") ||
    generatedPath.includes("\\") ||
    path.posix.isAbsolute(generatedPath) ||
    path.win32.isAbsolute(generatedPath) ||
    generatedPath.split("/").some((segment) => segment === ".." || segment === "." || segment === "")
  ) {
    throw new Error("Unsafe generated output path: " + JSON.stringify(generatedPath));
  }
  const root = path.resolve(outputDirectory);
  const destination = path.resolve(root, generatedPath);
  if (destination === root || !destination.startsWith(root + path.sep)) {
    throw new Error("Generated output escapes build directory: " + JSON.stringify(generatedPath));
  }
  return destination;
}
