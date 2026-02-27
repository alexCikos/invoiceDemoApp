# 06 - Troubleshooting Playbook

## Azure Login / Deployment

### `No subscriptions found for ***`

Check:
1. GitHub env values (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RG`).
2. Deployer app has `Contributor` on target RG.
3. Federated credential subject matches repo/environment.

### `MissingSubscriptionRegistration` for Key Vault

```bash
az provider register --namespace Microsoft.KeyVault
az provider show --namespace Microsoft.KeyVault --query registrationState -o tsv
```

## Graph / SharePoint

### `invalidRequest` on `POST /sites/{siteId}/permissions`

Use request body with `grantedToIdentities` in POST.

### `accessDenied` on `POST /sites/{siteId}/permissions`

Admin token lacks required privilege.
Use admin-grant app token (client credentials) with higher Graph permission for grant operations.

### Runtime token has `roles: None`

Admin consent or permission type issue.
Ensure Graph **Application** permission `Sites.Selected` exists and consent is granted.

### Runtime call returns `generalException`

Check:
1. Token includes `roles: ['Sites.Selected']`.
2. Site grant exists in `GET /sites/{siteId}/permissions`.
3. Wait a few minutes after consent/grant changes.

## Key Vault / Secrets

### `ForbiddenByRbac` when setting secret

Assign your user `Key Vault Secrets Officer` on the vault scope.

### Function returns `AADSTS7000215 invalid_client`

Check in order:
1. Key Vault secret value is correct (test token call manually with retrieved secret value).
2. Function app resolves Key Vault reference correctly.
3. App restart after settings/identity changes.

### Config reference refresh shows `AccessToKeyVaultDenied`

If output contains:
- `identityType: SystemAssigned`
- `status: AccessToKeyVaultDenied`

Then grant `Key Vault Secrets User` to system-assigned identity as fallback and refresh/restart.

## CLI Behavior Notes

### `az functionapp config appsettings set` returns `"value": null`

Expected masking behavior. It does not imply failure.

### zsh error: `no matches found: [system]`

Quote it:

```bash
--identities '[system]'
```

