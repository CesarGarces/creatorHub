# Dependency Management

## Rule

Every generated project must use the latest stable production versions.

Before generating:

- package.json
- pnpm-workspace.yaml
- turbo.json
- Docker files
- CI/CD files

verify that dependencies are current stable releases.

## Forbidden

- alpha
- beta
- rc
- canary
- deprecated packages

## Required

Prefer official libraries over community alternatives whenever possible.

Use modern APIs and latest documentation patterns.