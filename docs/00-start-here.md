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
2. The branch deployment workflow logs into Azure via OIDC.
3. Bicep deploys/updates infra.
4. Function code is built and deployed as zip.

Quality path:
1. Pull requests run template validation and, when function code changes, the `Test Functions` workflow.
2. Pushes that touch `invoice-tracker-functions/` also run the same function test workflow.
3. Local equivalent for the Functions app is `npm run typecheck && npm test`.

Runtime path:
1. Function registration loads JSON-backed reminder config and creates one HTTP handler per config entry.
2. Each generated handler reads app settings and builds explicit workflow dependencies and input.
3. Workflow requests a Graph app-only token through the injected helper.
4. Workflow reads SharePoint items and renders the subject/body templates with invoice data.
5. Token acquisition and SharePoint reads fail the run immediately when prerequisites are missing or Graph rejects the request.
6. Email sends stay item-scoped, and the email client retries transient DNS failures before returning a final send result.
7. Clients use explicit parameters instead of reading `process.env`.

## Identity Separation (Critical)

Use separate identities for separate jobs:
1. Deployment app registration (`gh-deployer-*`) for GitHub -> Azure.
2. Graph runtime app (`app-*-graph-*`) for Function -> Graph.
3. Admin grant app/user context for `POST /sites/{siteId}/permissions`.

Do not collapse these into one identity in client environments.

## Reading Order

Continue with:
- [01 - Bootstrap Dev Environment](./01-bootstrap-dev.md)
