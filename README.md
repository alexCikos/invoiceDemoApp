# Invoice Tracker Cloud Template

This repository is a reusable consultancy template for deploying an Azure Functions solution with Bicep + GitHub OIDC CI/CD.

Primary documentation lives in:
- [knowledgeBase.md](./knowledgeBase.md)

## Quick Start

1. Ensure prerequisites are installed (`node`, `az`, `func`, `git`).
2. Pin Node runtime locally:

```bash
nvm use
```

3. Bootstrap a new client environment:

```bash
./scripts/bootstrap-client.sh \
  dev
```

4. If this is a fresh subscription, register required providers once:

```bash
az account set --subscription <subscription-id>
az provider register --namespace Microsoft.KeyVault
```

5. Create a deployment Entra app registration (OIDC) and grant it `Contributor` on the target resource group.
6. Set GitHub environment variables for `dev`:
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RG`
7. Push to `dev` to trigger deployment.
8. Configure `prod` GitHub environment with the same variable names and prod values, then push/merge to `main` for production rollout.

9. Update parameter files for infrastructure naming and environment config:
- `infra/main.parameters.dev.json`
- `infra/main.parameters.prod.json`

Recommended naming style:
- `namePrefix: "<client>-<app>"` (example: `acme-invoice`)
- Function App result will look like `func-acme-invoice-dev-<uniqueSuffix>`.

Production bootstrap example:

```bash
./scripts/bootstrap-client.sh \
  prod
```

## Template Workflows

- `.github/workflows/validate-template.yml`
  - Pull request validation (TypeScript + Bicep syntax).
- `.github/workflows/deploy-dev.yml`
  - Deploys infrastructure and function code to Azure `dev` environment using `infra/main.parameters.dev.json`.
- `.github/workflows/deploy-prod.yml`
  - Deploys infrastructure and function code to Azure `prod` environment using `infra/main.parameters.prod.json`.
