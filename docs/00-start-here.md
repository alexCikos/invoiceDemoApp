# 00 - Start Here

## What This Template Does

This template gives you a repeatable way to deliver an invoice automation platform:
- Deploy Azure infrastructure with Bicep.
- Deploy Function App code from GitHub with OIDC.
- Integrate with SharePoint list data through Microsoft Graph.
- Keep runtime secrets in Key Vault.

## Architecture Mental Model

Deployment path:
1. Push to `dev` or `main`.
2. GitHub Actions logs into Azure via OIDC.
3. Bicep deploys/updates infra.
4. Function code is built and deployed as zip.

Runtime path:
1. Function reads app settings.
2. `GRAPH_CLIENT_SECRET` is resolved from Key Vault.
3. Function gets Graph app-only token.
4. Function reads SharePoint list items.

## Identity Separation (Critical)

Use separate identities for separate jobs:
1. Deployment app registration (`gh-deployer-*`) for GitHub -> Azure.
2. Graph runtime app (`app-*-graph-*`) for Function -> Graph.
3. Admin grant app/user context for `POST /sites/{siteId}/permissions`.

Do not collapse these into one identity in client environments.

## Reading Order

Continue with:
- [01 - Bootstrap Dev Environment](./01-bootstrap-dev.md)

