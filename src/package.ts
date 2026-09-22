import path from "node:path";

import type { ImportDeclaration, Program } from "./ast.js";
import { EvermoreDiagnosticError } from "./diagnostics.js";
import {
  loadProject,
  type LoadedProject,
  type ProjectSourceReader,
} from "./project.js";

export type PackageDependencySpec = {
  readonly path: string;
  readonly version: string;
};

export type PackageManifest = {
  readonly name: string;
  readonly version: string;
  readonly entry: string;
  readonly dependencies: Readonly<Record<string, PackageDependencySpec>>;
};

export type ResolvedPackage = {
  readonly manifestPath: string;
  readonly rootPath: string;
  readonly manifest: PackageManifest;
  readonly dependencies: ReadonlyMap<string, ResolvedPackage>;
};

export type LoadedPackageProject = LoadedProject & {
  readonly rootPackage: ResolvedPackage;
  readonly packages: readonly ResolvedPackage[];
};

export async function loadPackageProject(
  manifestPath: string,
  readSource: ProjectSourceReader,
): Promise<LoadedPackageProject> {
  const absoluteManifest = normalizeManifestPath(manifestPath);
  const packagesByManifest = new Map<string, ResolvedPackage>();
  const packagesByName = new Map<string, ResolvedPackage>();
  const resolving: string[] = [];

  const resolvePackage = async (
    currentManifestPath: string,
  ): Promise<ResolvedPackage> => {
    const absolute = normalizeManifestPath(currentManifestPath);
    const cycleIndex = resolving.indexOf(absolute);

    if (cycleIndex !== -1) {
      const cycle = [...resolving.slice(cycleIndex), absolute]
        .map((item) => path.basename(path.dirname(item)) || item)
        .join(" -> ");

      throw packageError(
        "E2706",
        "Package dependency cycle detected: " + cycle + ".",
        "Remove one dependency edge so the local package graph is acyclic.",
      );
    }

    const existing = packagesByManifest.get(absolute);
    if (existing) return existing;

    const text = await readManifest(absolute, readSource);
    const manifest = parseManifest(text, absolute);
    const rootPath = path.dirname(absolute);

    const sameName = packagesByName.get(manifest.name);
    if (
      sameName &&
      (sameName.manifestPath !== absolute ||
        sameName.manifest.version !== manifest.version)
    ) {
      throw packageError(
        "E2707",
        'Package "' +
          manifest.name +
          '" resolves to multiple identities in one project.',
        "M2 package composition requires one exact version/path per package name.",
      );
    }

    resolving.push(absolute);

    const dependencies = new Map<string, ResolvedPackage>();

    for (const [dependencyName, spec] of Object.entries(
      manifest.dependencies,
    )) {
      if (!isValidPackageName(dependencyName)) {
        throw packageError(
          "E2701",
          'Invalid dependency package name "' + dependencyName + '".',
          "Use lowercase package names containing letters, digits, and hyphens.",
        );
      }

      if (!isRelativePackagePath(spec.path)) {
        throw packageError(
          "E2703",
          'Dependency "' +
            dependencyName +
            '" must use a relative local path in M2.',
          "Use a path such as ../shared. Registry/network resolution is intentionally deferred.",
        );
      }

      const dependencyManifestPath = normalizeManifestPath(
        path.resolve(rootPath, spec.path),
      );
      const dependency = await resolvePackage(dependencyManifestPath);

      if (dependency.manifest.name !== dependencyName) {
        throw packageError(
          "E2705",
          'Dependency key "' +
            dependencyName +
            '" resolves to package "' +
            dependency.manifest.name +
            '".',
          "Make the dependency key match the package manifest name.",
        );
      }

      if (dependency.manifest.version !== spec.version) {
        throw packageError(
          "E2705",
          'Dependency "' +
            dependencyName +
            '" requires exact version ' +
            spec.version +
            " but resolved " +
            dependency.manifest.version +
            ".",
          "Update the dependency version or the local package manifest so they match exactly.",
        );
      }

      dependencies.set(dependencyName, dependency);
    }

    resolving.pop();

    const resolved: ResolvedPackage = {
      manifestPath: absolute,
      rootPath,
      manifest,
      dependencies,
    };

    packagesByManifest.set(absolute, resolved);
    packagesByName.set(manifest.name, resolved);
    return resolved;
  };

  const rootPackage = await resolvePackage(absoluteManifest);
  const entryPath = resolveEntryPath(rootPackage);

  const project = await loadProject(entryPath, readSource, {
    resolveBareImport: async (
      specifier,
      importerPath,
      declaration,
    ) =>
      resolvePackageImport(
        specifier,
        importerPath,
        declaration,
        [...packagesByManifest.values()],
      ),
  });

  return {
    ...project,
    rootPackage,
    packages: [...packagesByManifest.values()].sort((left, right) =>
      left.manifest.name.localeCompare(right.manifest.name),
    ),
  };
}

export function packageGraph(
  project: LoadedPackageProject,
): {
  readonly name: string;
  readonly version: string;
  readonly entry: string;
  readonly packages: readonly {
    readonly name: string;
    readonly version: string;
    readonly dependencies: Readonly<Record<string, string>>;
  }[];
} {
  return {
    name: project.rootPackage.manifest.name,
    version: project.rootPackage.manifest.version,
    entry: project.rootPackage.manifest.entry,
    packages: project.packages.map((item) => ({
      name: item.manifest.name,
      version: item.manifest.version,
      dependencies: Object.fromEntries(
        [...item.dependencies.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([name, dependency]) => [
            name,
            dependency.manifest.version,
          ]),
      ),
    })),
  };
}

async function readManifest(
  manifestPath: string,
  readSource: ProjectSourceReader,
): Promise<string> {
  try {
    return await readSource(manifestPath);
  } catch {
    throw packageError(
      "E2700",
      'Cannot read package manifest "' + manifestPath + '".',
      "Create evermore.json at the declared local package path.",
    );
  }
}

function parseManifest(
  source: string,
  manifestPath: string,
): PackageManifest {
  let raw: unknown;

  try {
    raw = JSON.parse(source);
  } catch {
    throw packageError(
      "E2700",
      'Package manifest "' + manifestPath + '" is not valid JSON.',
      "Fix the JSON syntax in evermore.json.",
    );
  }

  if (!isRecord(raw)) {
    throw packageError(
      "E2700",
      "Package manifest must contain a JSON object.",
      "Declare name, version, entry, and optional dependencies.",
    );
  }

  const name = raw.name;
  const version = raw.version;
  const entry = raw.entry;
  const dependenciesRaw = raw.dependencies ?? {};

  if (typeof name !== "string" || !isValidPackageName(name)) {
    throw packageError(
      "E2701",
      "Package name is missing or invalid.",
      "Use a lowercase package name such as atlas-core.",
    );
  }

  if (typeof version !== "string" || !isExactVersion(version)) {
    throw packageError(
      "E2702",
      'Package "' + name + '" has an invalid version.',
      "M2 package manifests use exact semantic versions such as 1.2.3.",
    );
  }

  if (
    typeof entry !== "string" ||
    entry.length === 0 ||
    path.isAbsolute(entry)
  ) {
    throw packageError(
      "E2703",
      'Package "' + name + '" has an invalid entry path.',
      "Use a relative .ever entry path such as src/main.ever.",
    );
  }

  if (!isRecord(dependenciesRaw)) {
    throw packageError(
      "E2700",
      'Package "' + name + '" dependencies must be a JSON object.',
      "Map dependency names to { path, version } objects.",
    );
  }

  const dependencies: Record<string, PackageDependencySpec> = {};

  for (const [dependencyName, value] of Object.entries(
    dependenciesRaw,
  )) {
    if (
      !isRecord(value) ||
      typeof value.path !== "string" ||
      typeof value.version !== "string" ||
      !isExactVersion(value.version)
    ) {
      throw packageError(
        "E2700",
        'Dependency "' +
          dependencyName +
          '" must declare string path and exact version.',
        'Use { "path": "../shared", "version": "1.0.0" }.',
      );
    }

    dependencies[dependencyName] = {
      path: value.path,
      version: value.version,
    };
  }

  return {
    name,
    version,
    entry,
    dependencies,
  };
}

function resolveEntryPath(pkg: ResolvedPackage): string {
  const target = path.resolve(pkg.rootPath, pkg.manifest.entry);

  if (!isInside(pkg.rootPath, target)) {
    throw packageError(
      "E2703",
      'Package "' + pkg.manifest.name + '" entry escapes its package root.',
      "Keep package entry files inside the package directory.",
    );
  }

  return target;
}

function resolvePackageImport(
  specifier: string,
  importerPath: string,
  declaration: ImportDeclaration,
  packages: readonly ResolvedPackage[],
): string {
  const owner = owningPackage(importerPath, packages);

  if (!owner) {
    throw packageError(
      "E2704",
      'Cannot determine package ownership for "' + importerPath + '".',
      "Compile package imports through their root evermore.json manifest.",
      declaration.span,
    );
  }

  const [dependencyName, ...subpath] = specifier.split("/");
  if (!dependencyName) {
    throw packageError(
      "E2704",
      'Invalid package import "' + specifier + '".',
      "Import a declared package dependency by name.",
      declaration.span,
    );
  }

  const dependency = owner.dependencies.get(dependencyName);

  if (!dependency) {
    throw packageError(
      "E2704",
      'Package "' +
        owner.manifest.name +
        '" does not declare dependency "' +
        dependencyName +
        '".',
      "Add the dependency to evermore.json before importing it.",
      declaration.span,
    );
  }

  const rawTarget =
    subpath.length === 0
      ? dependency.manifest.entry
      : subpath.join("/") +
        (subpath[subpath.length - 1]?.endsWith(".ever")
          ? ""
          : ".ever");

  const target = path.resolve(dependency.rootPath, rawTarget);

  if (!isInside(dependency.rootPath, target)) {
    throw packageError(
      "E2708",
      'Package import "' + specifier + '" escapes the dependency root.',
      "Import only files contained in the declared dependency package.",
      declaration.span,
    );
  }

  return target;
}

function owningPackage(
  sourcePath: string,
  packages: readonly ResolvedPackage[],
): ResolvedPackage | undefined {
  return [...packages]
    .filter((item) => isInside(item.rootPath, sourcePath))
    .sort(
      (left, right) =>
        right.rootPath.length - left.rootPath.length,
    )[0];
}

function normalizeManifestPath(value: string): string {
  const absolute = path.resolve(value);
  return path.basename(absolute) === "evermore.json"
    ? absolute
    : path.join(absolute, "evermore.json");
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function isRelativePackagePath(value: string): boolean {
  return (
    value === "." ||
    value.startsWith("./") ||
    value.startsWith("../")
  );
}

function isValidPackageName(value: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(value);
}

function isExactVersion(value: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function packageError(
  code: string,
  message: string,
  help: string,
  span: Program["span"] = emptySpan(),
): EvermoreDiagnosticError {
  return new EvermoreDiagnosticError([
    {
      code,
      severity: "error",
      message,
      span,
      help,
    },
  ]);
}

function emptySpan(): Program["span"] {
  return {
    start: { offset: 0, line: 1, column: 1 },
    end: { offset: 0, line: 1, column: 1 },
  };
}
