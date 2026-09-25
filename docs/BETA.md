# Evermore 0.1.0-beta.1 — usable web beta candidate

Evermore is proprietary software. This is a **beta candidate for the Vue/Vite vertical slice**, not a claim that every research backend or planned language feature is stable. The baseline compiler has M0–M9 executable research evidence; this release adds a practical start-to-run path. No npm registry release is implied by this version string.

## Requirements and installation

Node.js 22 or newer and npm. From an authorized source checkout:

~~~sh
npm install
npm run check
npm test
npm run build
npm link
evermore --help
~~~

The executable is also available without a global link as **node dist/src/cli.js**. An installation from GitHub builds from source using the package's prepare script. No hosted Evermore package registry or signed binary distribution is currently provided.

## Start a project

~~~sh
evermore init my-first-app
evermore check my-first-app/evermore.json
evermore test my-first-app/evermore.json
evermore format my-first-app/main.ever --check
evermore build my-first-app/evermore.json --target vue --out my-first-web
evermore run my-first-app/evermore.json
~~~

**init** refuses to replace an existing non-empty directory and creates a manifest, canonical .ever source, and .gitignore. **build** writes a normal inspectable Vue/Vite project. **run** compiles to .evermore-build/vue, installs generated npm dependencies if missing (requires network access), and starts its Vite development server bound to 127.0.0.1. Use --no-install to forbid dependency installation; use Ctrl+C to stop the server.

**test <entry.ever|evermore.json|directory>** is a compiler/semantic acceptance command. It checks independent application entrypoints and package manifests, skips module-only .ever files, and returns nonzero if any application fails. **It is not an application runtime unit-test framework.** Use generated target tests and the repository's npm test for those purposes. Directory discovery ignores generated folders and symlink entries. A library package with a module-only entrypoint is not a runnable app suite; point test at an app consumer.

**format --check** never edits source; it returns nonzero for unformatted source. Use --write for edits, not both flags.

## Supported paths versus experiments

| Surface | Status for this beta candidate |
| --- | --- |
| Lexer, parser, typed core, project imports, local package manifests, semantic diagnostics | Exercised by compiler tests; APIs and syntax remain pre-1.0 |
| Vue/Vite web generation | Primary end-to-end target; generated application is built in CI |
| Node service, AI, React Native, Python, infrastructure | Implemented research slices with dedicated CI evidence, not an across-the-board production guarantee |
| Flutter, WebAssembly | Explicitly experimental backends |
| Remote package install/publish, immutable lockfiles, comprehensive standard library | Not implemented as a supported release workflow |
| Deployment/security certification and stable cross-version compatibility | Not claimed |

CI: [compiler workflow](../.github/workflows/ci.yml) and [beta CLI smoke workflow](../.github/workflows/beta-cli.yml). The beta workflow checks the compiler and CLI, scaffolds and compiles a project in a fresh directory, builds generated Vue output and inspects the npm package contents.

## Compatibility and reporting

The compiler's release version is 0.1.0-beta.1; IR metadata and generated-manifest versions are separate internal schemas and are not SemVer guarantees. No API/grammar stability or migration promise exists before 1.0. Keep generated artifacts inspectable, pin dependency versions in applications, and test before deployment. Treat generated infrastructure apply as a distinct opt-in operation.

Report a minimal failing .ever program, the exact command, node --version, diagnostics, and target in a GitHub issue. Avoid publishing secrets, personal data or private model credentials. See [SECURITY.md](../SECURITY.md) for security reports and [ROADMAP.md](./ROADMAP.md) for unimplemented M10 work.
