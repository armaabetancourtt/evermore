# M7 Infrastructure Research Notes

## Decision

Evermore infrastructure is compiled as inspectable deployment intent rather than executed as an implicit side effect.

M7 emits a machine-readable deployment plan, generated Docker/Kubernetes artifacts, and separate plan/apply/rollback scripts.

## Portable intent boundary

The core deployment model includes a server, immutable image reference, replicas, port, liveness/readiness paths, external environment sources, external secret references, observability mode, and rollback history. Cloud-specific APIs stay outside the language until evidence shows that a concept belongs in the portable semantic core.

## Safe defaults

Generated Kubernetes manifests include probes, revision history, stable labels, pinned image policy, and secret/config references. Docker packaging uses a multi-stage Node build. Generated artifacts remain inspectable rather than hidden behind an opaque deploy command.

## Plan/apply separation

Compilation never mutates infrastructure. The generated plan script performs a server-side Kubernetes dry run. Apply and rollback scripts refuse mutation unless EVERMORE_APPLY=1 is explicitly set.

## Secret policy

Evermore stores external secret keys, not secret values. Semantic analysis rejects literal-looking secret assignments and requires database connection variables to use the secret surface. Kubernetes generation uses secretKeyRef.

## Future work

Future backends can add cloud adapters, signed plans, policy engines, and richer permission analysis while lowering from the same deployment IR.
