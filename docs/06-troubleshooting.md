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

## Exchange / Mail.Send RBAC

### `AADServicePrincipalNotFound` on `New-ServicePrincipal`

You used the wrong object ID.
Use the **Enterprise application service principal object ID** in the same tenant:

```bash
az ad sp show --id <app-client-id> --query id -o tsv
```

### `The command you tried to run isn't currently allowed ... Enable-OrganizationCustomization`

Run:

```powershell
Enable-OrganizationCustomization -Confirm:$false
Get-OrganizationConfig | Format-List IsDehydrated
```

Expected: `IsDehydrated : False`.

### `You don't have sufficient permissions ... manager of the group`

Your account lacks Exchange RBAC authority for that role group.
Use a tenant admin account with Exchange org-level rights or have the client run the command.

### `Test-ServicePrincipalAuthorization ... InScope False`

Common causes:
1. Scope group does not exist.
2. Mailbox is not a member of scope group.
3. Management scope was created with empty DN (`MemberOfGroup -eq ''`).

Verify and fix:

```powershell
Get-DistributionGroup -Identity <scope-group>
Get-DistributionGroupMember -Identity <scope-group> -ResultSize Unlimited
Get-ManagementScope -Identity <scope-name> | Format-List Name,RecipientFilter
```

If needed, reset scope filter:

```powershell
$groupDn = (Get-DistributionGroup -Identity <scope-group>).DistinguishedName
Set-ManagementScope -Identity <scope-name> -RecipientRestrictionFilter "MemberOfGroup -eq '$groupDn'"
```

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
