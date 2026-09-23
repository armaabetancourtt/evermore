# Evermore Package Registry Design

## Purpose

The registry is a content-addressed distribution layer for Evermore packages. Package identity is `name@version`; published versions are immutable.

## Minimum metadata

Each release records:

- package name and exact semantic version;
- entry source path;
- dependency names and exact versions;
- source archive digest;
- compiler compatibility range;
- optional documentation digest;
- provenance and signature metadata.

## Resolution

Resolution is deterministic. Manifests use exact versions in M8; a lockfile records package digests. The resolver refuses a package when the downloaded content does not match the registry digest.

## Security

The registry does not execute install scripts. Packages are source plus metadata. Future signing support should use publisher keys, transparent provenance and revocation metadata rather than mutable package contents.

## API sketch

`GET /v1/packages/{name}/{version}` returns immutable metadata and a content digest.

`GET /v1/blobs/{sha256}` returns the corresponding source archive.

`PUT /v1/packages/{name}/{version}` is create-only and fails if the version already exists.

This document defines the M8 registry contract; a hosted registry service is intentionally outside the compiler repository.
