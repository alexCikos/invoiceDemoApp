# 02 - GitHub OIDC Deployment Setup

## 1) Create Deployment App Registration

Create one per environment:
- `gh-deployer-<client>-dev`
- `gh-deployer-<client>-prod`

Capture:
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`

If needed:

```bash
az ad sp create --id <AZURE_CLIENT_ID>
```

## 2) Add Federated Credentials

In each deployer app registration:
- Add federated credential for GitHub Actions.
- Subject examples:
  - `repo:<org>/<repo>:environment:dev`
  - `repo:<org>/<repo>:environment:prod`

## 3) Grant Azure RBAC

Run once per environment:

```bash
az role assignment create \
  --assignee <AZURE_CLIENT_ID> \
  --role Contributor \
  --scope /subscriptions/<AZURE_SUBSCRIPTION_ID>/resourceGroups/<AZURE_RG>

az role assignment list \
  --assignee <AZURE_CLIENT_ID> \
  --scope /subscriptions/<AZURE_SUBSCRIPTION_ID>/resourceGroups/<AZURE_RG> \
  -o table
```

## 4) Configure GitHub Environments

`dev` environment variables:
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RG`

`prod` environment variables:
- Same variable names, production values.

## 5) Deploy Dev

```bash
git checkout dev
git push
```

or first push:

```bash
git push -u origin dev
```

## 6) Next

Continue with:
- [03 - Promote To Production](./03-promote-to-prod.md)

