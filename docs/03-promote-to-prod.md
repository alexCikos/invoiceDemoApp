# 03 - Promote To Production

## 1) Fill Prod Parameters

Edit:
- `infra/main.parameters.prod.json`

Set:
- `environmentName` = `prod`
- `graphTenantId`
- `graphClientId` (prod runtime app ID)
- `graphClientSecretName`
- `sharePointSiteId`
- `sharePointListId` (prod list)

## 2) Bootstrap Prod Infra

```bash
./scripts/bootstrap-client.sh prod
```

## 3) Ensure Prod GitHub Environment Exists

Set:
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RG` (prod RG)

## 4) Merge Dev -> Main

```bash
git checkout main
git pull origin main
git merge dev
git push origin main
```

## 5) Why `pull` Here?

`git pull origin main` ensures local `main` has latest remote commits before merge, so you do not merge into stale history.

## 6) Next

Continue with:
- [04 - Graph + SharePoint Integration](./04-graph-sharepoint-integration.md)

