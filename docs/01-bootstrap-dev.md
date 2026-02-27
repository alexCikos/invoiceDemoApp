# 01 - Bootstrap Dev Environment

## 1) Prerequisites

Install and verify:

```bash
node -v
npm -v
func --version
az --version
git --version
```

Use Node 22 locally:

```bash
nvm use
```

If not installed:

```bash
nvm install 22
nvm use 22
```

## 2) One-Time Provider Registration (Per Subscription)

```bash
az account set --subscription <subscription-id>
az provider register --namespace Microsoft.Storage
az provider register --namespace Microsoft.Web
az provider register --namespace Microsoft.ManagedIdentity
az provider register --namespace Microsoft.KeyVault
az provider register --namespace Microsoft.Insights
az provider register --namespace Microsoft.OperationalInsights

az provider show --namespace Microsoft.KeyVault --query registrationState -o tsv
```

Expected: `Registered`.

## 3) Fill Dev Parameters

Edit:
- `infra/main.parameters.dev.json`

Set at minimum:
- `namePrefix` (example: `acme-invoice`)
- `environmentName` (`dev`)
- `graphTenantId`
- `graphClientId`
- `graphClientSecretName` (default: `GRAPH-CLIENT-SECRET`)
- `sharePointSiteId`
- `sharePointListId`

## 4) Bootstrap Dev Infra

```bash
./scripts/bootstrap-client.sh dev
```

This creates/updates dev infra and prints outputs.

## 5) Next

Continue with:
- [02 - GitHub OIDC Deployment Setup](./02-github-oidc-deploy.md)

