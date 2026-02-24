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
  <subscription-id> \
  rg-<client>-invoice-dev \
  australiaeast \
  <clientprefix> \
  dev
```

4. If this is a fresh subscription, register required providers once:

```bash
az account set --subscription <subscription-id>
az provider register --namespace Microsoft.KeyVault
```

5. Set GitHub environment variables for `dev`.
6. Push to `dev` to trigger deployment.
7. Configure `prod` GitHub environment and push/merge to `main` for production rollout.

Production bootstrap example:

```bash
./scripts/bootstrap-client.sh \
  <subscription-id> \
  rg-<client>-invoice-prod \
  australiaeast \
  <clientprefixprod> \
  prod
```

## Template Workflows

- `.github/workflows/validate-template.yml`
  - Pull request validation (TypeScript + Bicep syntax).
- `.github/workflows/deploy-dev.yml`
  - Deploys infrastructure and function code to Azure `dev` environment.
- `.github/workflows/deploy-prod.yml`
  - Deploys infrastructure and function code to Azure `prod` environment.
