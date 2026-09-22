# Security Policy

## Project status

Evermore is **experimental pre-alpha software**.

Do not use the compiler or generated artifacts for production-critical systems yet.

The project is actively designing security semantics, capability tracking and information-flow analysis, but those systems are not complete.

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's security reporting / advisory flow for this repository when available.

Avoid publishing an exploit in a public issue before maintainers have had an opportunity to understand and address it.

Useful reports include:

- affected compiler version or commit;
- minimal Evermore source that reproduces the issue;
- generated target artifacts when relevant;
- expected behavior;
- observed behavior;
- security impact;
- platform/runtime information.

## Security-sensitive areas

We are especially interested in issues involving:

- compiler path traversal or unsafe file generation;
- generated-code injection;
- escaping failures;
- unsafe native-extension boundaries;
- secret exposure;
- capability bypass;
- information-flow violations;
- agent tool authorization;
- prompt/tool injection boundaries;
- infrastructure plan/apply authorization;
- dependency/supply-chain behavior.

## Generated code

Generated code is not automatically safe merely because it was produced by Evermore.

Until security guarantees are formally documented and tested:

- review generated artifacts;
- use normal dependency scanning;
- use least-privilege credentials;
- isolate experimental deployments;
- do not place real secrets in source files.

## Long-term security direction

Evermore's research direction includes:

~~~text
Public ⊑ Internal ⊑ Sensitive ⊑ Secret
~~~

plus effect and capability analysis.

The goal is for the compiler to prevent classes of unsafe behavior before deployment, but no such claim should be assumed until the relevant feature is implemented and validated.
