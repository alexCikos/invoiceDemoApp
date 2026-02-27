# 05 - Secrets, App Settings, Local Dev

## 1) Put Runtime Graph Secret In Key Vault

```bash
KV_NAME='<key-vault-name>'
GRAPH_CLIENT_SECRET_NAME='GRAPH-CLIENT-SECRET'

az keyvault secret set \
  --vault-name "$KV_NAME" \
  --name "$GRAPH_CLIENT_SECRET_NAME" \
  --value '<graph-runtime-app-secret-value>'
```

## 2) If You Cannot Write Secret (`ForbiddenByRbac`)

Assign yourself a Key Vault data-plane role:

```bash
az account show --query "{sub:id, tenant:tenantId, user:user.name}" -o table

KV_SCOPE=$(az keyvault show -n "$KV_NAME" --query id -o tsv)
USER_OBJECT_ID=$(az ad signed-in-user show --query id -o tsv)

az role assignment create \
  --assignee-object-id "$USER_OBJECT_ID" \
  --assignee-principal-type User \
  --role "Key Vault Secrets Officer" \
  --scope "$KV_SCOPE"

az role assignment list \
  --assignee-object-id "$USER_OBJECT_ID" \
  --scope "$KV_SCOPE" \
  -o table
```

## 3) Ensure Function Identity Can Read Secret

```bash
RG='<resource-group>'
APP_NAME='<function-app-name>'

UAMI_ID=$(az functionapp identity show -g "$RG" -n "$APP_NAME" --query "keys(userAssignedIdentities)[0]" -o tsv)
UAMI_PRINCIPAL_ID=$(az identity show --ids "$UAMI_ID" --query principalId -o tsv)
KV_SCOPE=$(az keyvault show -n "$KV_NAME" --query id -o tsv)

az role assignment create \
  --assignee-object-id "$UAMI_PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Key Vault Secrets User" \
  --scope "$KV_SCOPE"
```

For older environments, force Key Vault reference identity:

```bash
az resource update \
  -g "$RG" \
  -n "$APP_NAME" \
  --resource-type "Microsoft.Web/sites" \
  --set properties.keyVaultReferenceIdentity="$UAMI_ID"
```

## 4) If Refresh Shows `identityType: SystemAssigned` + `AccessToKeyVaultDenied`

Add system-assigned identity fallback and grant it vault read:

```bash
# zsh note: quote '[system]' to avoid globbing.
az functionapp identity assign \
  -g "$RG" \
  -n "$APP_NAME" \
  --identities '[system]' "$UAMI_ID"

SYS_PID=$(az functionapp identity show -g "$RG" -n "$APP_NAME" --query principalId -o tsv)

az role assignment create \
  --assignee-object-id "$SYS_PID" \
  --assignee-principal-type ServicePrincipal \
  --role "Key Vault Secrets User" \
  --scope "$KV_SCOPE"
```

Refresh and restart:

```bash
SUB_ID=$(az account show --query id -o tsv)

az rest --method post \
  --url "https://management.azure.com/subscriptions/${SUB_ID}/resourceGroups/${RG}/providers/Microsoft.Web/sites/${APP_NAME}/config/configreferences/appsettings/refresh?api-version=2022-03-01"

az functionapp restart -g "$RG" -n "$APP_NAME"
```

## 5) Runtime Settings Source

These values are deployed by Bicep from `infra/main.parameters.<env>.json`:
- `GRAPH_TENANT_ID`
- `GRAPH_CLIENT_ID`
- `GRAPH_CLIENT_SECRET` (Key Vault reference)
- `SHAREPOINT_SITE_ID`
- `SHAREPOINT_LIST_ID`

## 6) Local Development

In `my-func-api/local.settings.json`:
- Use the same setting names.
- Set `GRAPH_CLIENT_SECRET` to a real local secret value (not Key Vault reference syntax).

Run locally:

```bash
cd my-func-api
npm ci
npm run start
```

Test endpoint:

```bash
curl "http://localhost:7071/api/sharepoint-list-test?top=3"
```

## 7) Next

Continue with:
- [06 - Troubleshooting Playbook](./06-troubleshooting.md)

