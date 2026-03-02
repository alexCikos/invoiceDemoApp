# 04 - Graph + SharePoint Integration

## 1) Create Runtime Graph App

Create one per environment:
- `app-<client>-invoice-graph-dev`
- `app-<client>-invoice-graph-prod`

Add Microsoft Graph Application permission:
- `Sites.Selected`

Grant admin consent.

## 2) Use Team Site, Not Personal Site

Use site URLs like:
- `https://<tenant>.sharepoint.com/sites/<SiteName>`

Avoid personal URLs for this integration:
- `https://<tenant>-my.sharepoint.com/personal/...`

## 3) Resolve Site and List IDs

```bash
TOKEN=$(az account get-access-token --resource-type ms-graph --query accessToken -o tsv)

curl -sS \
  -H "Authorization: Bearer $TOKEN" \
  "https://graph.microsoft.com/v1.0/sites/<tenant>.sharepoint.com:/sites/<site-name>?\$select=id,webUrl,displayName"
```

Then list lists:

```bash
SITE_ID='<site-id>'
curl -sS -G \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode "\$select=id,displayName" \
  "https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists" | jq .
```

## 4) Grant Site Permission to Runtime App

Grant is at site scope, not list scope.

Set values:

```bash
SITE_ID='<site-id>'
TARGET_APP_ID='<graph-runtime-client-id>'
TARGET_APP_NAME='app-<client>-invoice-graph-prod'
```

Use admin token/context:

```bash
ADMIN_TOKEN=$(az account get-access-token --resource-type ms-graph --query accessToken -o tsv)
```

Create grant:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  "https://graph.microsoft.com/v1.0/sites/${SITE_ID}/permissions" \
  -d "{
    \"roles\": [\"write\"],
    \"grantedToIdentities\": [
      {
        \"application\": {
          \"id\": \"${TARGET_APP_ID}\",
          \"displayName\": \"${TARGET_APP_NAME}\"
        }
      }
    ]
  }" | jq .
```

Verify grant:

```bash
curl -sS \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  "https://graph.microsoft.com/v1.0/sites/${SITE_ID}/permissions" | jq .
```

Focused verify:

```bash
curl -sS \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  "https://graph.microsoft.com/v1.0/sites/${SITE_ID}/permissions" \
  | jq --arg APPID "$TARGET_APP_ID" '.value[] | select(.grantedToIdentitiesV2[0].application.id == $APPID) | {id,roles,app:.grantedToIdentitiesV2[0].application}'
```

## 5) If You Get `accessDenied` On POST

Your token lacks the required Graph privilege for site grants.

Use dedicated admin-grant app (client credentials) with high Graph permission (for example `Sites.FullControl.All`) to make grant calls:

```bash
TENANT_ID='<tenant-id>'
ADMIN_GRANT_APP_ID='<admin-grant-app-id>'
ADMIN_GRANT_APP_SECRET='<admin-grant-app-secret>'

ADMIN_TOKEN=$(curl -sS -X POST "https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=${ADMIN_GRANT_APP_ID}" \
  -d "client_secret=${ADMIN_GRANT_APP_SECRET}" \
  -d "scope=https%3A%2F%2Fgraph.microsoft.com%2F.default" \
  -d "grant_type=client_credentials" | jq -r .access_token)
```

## 6) Validate Runtime App Token and List Read

```bash
GRAPH_TENANT_ID='<tenant-id>'
GRAPH_CLIENT_ID='<runtime-app-client-id>'
GRAPH_CLIENT_SECRET='<runtime-app-secret-value>'

TOKEN_JSON=$(curl -s -X POST "https://login.microsoftonline.com/${GRAPH_TENANT_ID}/oauth2/v2.0/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=${GRAPH_CLIENT_ID}" \
  -d "client_secret=${GRAPH_CLIENT_SECRET}" \
  -d "scope=https%3A%2F%2Fgraph.microsoft.com%2F.default" \
  -d "grant_type=client_credentials")
APP_TOKEN=$(echo "$TOKEN_JSON" | jq -r .access_token)
```

List read:

```bash
curl -sS -G \
  -H "Authorization: Bearer ${APP_TOKEN}" \
  --data-urlencode "\$top=3" \
  --data-urlencode "\$expand=fields" \
  "https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/<list-id>/items" | jq .
```

## 7) Add Mail Send Permission (Runtime App)

For invoice reminders, the runtime app also needs Graph **Application** permission:
- `Mail.Send`

Grant admin consent after adding it.

Notes:
- Use **Application** permission (not delegated).
- In app-only flow, send mail with:
  - `POST /v1.0/users/{senderMailbox}/sendMail`
- Do not use `/me/sendMail` for client-credentials flow.

## 8) Scope Mail Sending With Exchange App RBAC (Recommended For Prod)

Run this once per environment (for example separate scope names for `dev` and `prod`).

### 8.1 Prereqs (macOS)

```bash
brew install --cask powershell
pwsh
```

In PowerShell:

```powershell
Install-Module ExchangeOnlineManagement -Scope CurrentUser -Force
Import-Module ExchangeOnlineManagement
Connect-ExchangeOnline -UserPrincipalName "<exchange-admin-upn>"
```

### 8.2 Set Variables

```powershell
$appId = "<runtime-app-client-id>"
$senderMailbox = "invoicereminders@<tenant>.onmicrosoft.com"
$scopeGroupName = "InvoiceReminderScope-Prod"
$scopeName = "InvoiceReminderMailboxScope-Prod"
$roleAssignmentName = "InvoiceReminder-MailSend-Prod"
$exoSpDisplayName = "Invoice Reminder App Prod"
```

Get the service principal object ID for this app in the current tenant:

```powershell
$spObjectId = (az ad sp show --id $appId --query id -o tsv).Trim()
$spObjectId
```

### 8.3 One-Time Tenant Customization Check

```powershell
Enable-OrganizationCustomization -Confirm:$false
Get-OrganizationConfig | Format-List IsDehydrated
```

Expected:
- `IsDehydrated : False`

### 8.4 Create Exchange Mapping, Scope Group, and Role Assignment

```powershell
if (-not (Get-ServicePrincipal -Identity $spObjectId -ErrorAction SilentlyContinue)) {
  New-ServicePrincipal -AppId $appId -ObjectId $spObjectId -DisplayName $exoSpDisplayName
}

if (-not (Get-DistributionGroup -Identity $scopeGroupName -ErrorAction SilentlyContinue)) {
  New-DistributionGroup -Name $scopeGroupName -Type Security
}

if (-not (Get-DistributionGroupMember -Identity $scopeGroupName -ResultSize Unlimited | Where-Object { $_.PrimarySmtpAddress -eq $senderMailbox })) {
  Add-DistributionGroupMember -Identity $scopeGroupName -Member $senderMailbox
}

$groupDn = (Get-DistributionGroup -Identity $scopeGroupName).DistinguishedName

if (-not (Get-ManagementScope -Identity $scopeName -ErrorAction SilentlyContinue)) {
  New-ManagementScope -Name $scopeName -RecipientRestrictionFilter "MemberOfGroup -eq '$groupDn'"
} else {
  Set-ManagementScope -Identity $scopeName -RecipientRestrictionFilter "MemberOfGroup -eq '$groupDn'"
}

if (-not (Get-ManagementRoleAssignment -Identity $roleAssignmentName -ErrorAction SilentlyContinue)) {
  New-ManagementRoleAssignment -Name $roleAssignmentName -Role "Application Mail.Send" -App $appId -CustomResourceScope $scopeName
}
```

### 8.5 Validate Scope Works

```powershell
Get-ManagementScope -Identity $scopeName | Format-List Name,RecipientFilter

Test-ServicePrincipalAuthorization -Identity $appId -Resource $senderMailbox |
  Format-Table RoleName,GrantedPermissions,AllowedResourceScope,InScope
```

Expected:
- Role contains `Application Mail.Send`
- `InScope = True`

## 9) Prod/Client Checklist

For each client tenant and each environment:
1. Create environment-specific sender mailbox.
2. Grant `Mail.Send` (Application) + admin consent on the matching runtime app.
3. Create environment-specific Exchange scope group and management scope.
4. Validate with `Test-ServicePrincipalAuthorization` before code rollout.
5. Store mailbox address in app settings (for example `REMINDER_SENDER_MAILBOX`).

## 10) Next

Continue with:
- [05 - Secrets, App Settings, Local Dev](./05-secrets-runtime-local.md)
