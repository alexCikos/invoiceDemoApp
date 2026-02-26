targetScope = 'resourceGroup'

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Client-app naming prefix used in resource names, e.g. "acme-invoice".')
@minLength(2)
@maxLength(20)
param namePrefix string

@description('Deployment environment label used in names and tags')
@allowed([
  'dev'
  'test'
  'prod'
])
param environmentName string = 'dev'

@description('Optional extra tags merged onto all resources')
param tags object = {}

@description('Create Key Vault RBAC role assignment for the Function managed identity. Requires roleAssignments/write permission.')
param enableKeyVaultRoleAssignment bool = false

@description('Microsoft Entra tenant ID used for Graph app-only token requests.')
param graphTenantId string = ''

@description('Application (client) ID for the Graph runtime app registration.')
param graphClientId string = ''

@description('Key Vault secret name that stores the Graph app client secret value.')
param graphClientSecretName string = 'GRAPH-CLIENT-SECRET'

@description('Graph scope used for client_credentials token requests.')
param graphScope string = 'https://graph.microsoft.com/.default'

@description('SharePoint site ID in Graph format: "<host>,<siteCollectionId>,<siteId>".')
param sharePointSiteId string = ''

@description('SharePoint list ID (GUID) used by the reminder automation.')
param sharePointListId string = ''

// Keep a hyphenated slug for human-readable names.
var workloadSlug = toLower(replace(replace(namePrefix, '_', '-'), ' ', '-'))

// Also keep an alphanumeric variant for resources with stricter naming rules.
var normalizedPrefix = toLower(replace(replace(replace(namePrefix, '-', ''), '_', ''), ' ', ''))
var suffix = uniqueString(resourceGroup().id)

// Resource-name safety guards for platform-specific constraints.
var storageName = take('sa${normalizedPrefix}${suffix}', 24)
var keyVaultName = toLower(take('kv${normalizedPrefix}${substring(suffix, 0, 10)}', 24))
var functionAppName = toLower(take('func-${workloadSlug}-${environmentName}-${suffix}', 60))
var planName = toLower(take('${workloadSlug}-${environmentName}-asp', 40))
var uamiName = toLower(take('${workloadSlug}-${environmentName}-uami', 64))
var logAnalyticsName = toLower(take('${workloadSlug}-${environmentName}-law', 63))
var appInsightsName = toLower(take('${workloadSlug}-${environmentName}-appi', 260))

var commonTags = union({
  workload: 'invoice-tracker'
  environment: environmentName
  managedBy: 'bicep'
}, tags)

// ---- Storage account (host storage for Functions) ----
resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageName
  location: location
  tags: commonTags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
  }
}

// ---- Log Analytics workspace (required for workspace-based App Insights) ----
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  tags: commonTags
  properties: {
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    sku: {
      name: 'PerGB2018'
    }
  }
}

// ---- Application Insights (connection-string based telemetry target) ----
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: commonTags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// ---- Hosting plan (Linux Consumption) ----
resource plan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: planName
  location: location
  tags: commonTags
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {
    reserved: true // Required for Linux workers.
  }
}

// ---- User-assigned managed identity (stable runtime identity) ----
resource uami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: uamiName
  location: location
  tags: commonTags
}

// ---- Key Vault (for client secrets/config referenced by app settings) ----
resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: keyVaultName
  location: location
  tags: commonTags
  properties: {
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enabledForDeployment: false
    enabledForTemplateDeployment: false
    enabledForDiskEncryption: false
    publicNetworkAccess: 'Enabled'
    sku: {
      family: 'A'
      name: 'standard'
    }
    softDeleteRetentionInDays: 90
  }
}

// ---- Function App ----
resource func 'Microsoft.Web/sites@2023-01-01' = {
  name: functionAppName
  location: location
  tags: commonTags
  kind: 'functionapp,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${uami.id}': {}
    }
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    // Ensure Key Vault references are resolved using the user-assigned identity.
    keyVaultReferenceIdentity: uami.id
    siteConfig: {
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      linuxFxVersion: 'Node|22'
      appSettings: [
        // Host storage account connection for Functions runtime.
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
        }

        // Functions runtime config.
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }

        // App Insights uses connection strings (recommended over instrumentation key).
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }

        // Useful application metadata surfaced to the function runtime.
        {
          name: 'KEY_VAULT_URI'
          value: keyVault.properties.vaultUri
        }
        {
          name: 'CLIENT_CODE'
          value: workloadSlug
        }
        {
          name: 'ENVIRONMENT_NAME'
          value: environmentName
        }

        // Graph + SharePoint integration settings consumed by function code.
        {
          name: 'GRAPH_TENANT_ID'
          value: graphTenantId
        }
        {
          name: 'GRAPH_CLIENT_ID'
          value: graphClientId
        }
        {
          name: 'GRAPH_CLIENT_SECRET'
          value: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/${graphClientSecretName}/)'
        }
        {
          name: 'GRAPH_SCOPE'
          value: graphScope
        }
        {
          name: 'SHAREPOINT_SITE_ID'
          value: sharePointSiteId
        }
        {
          name: 'SHAREPOINT_LIST_ID'
          value: sharePointListId
        }
      ]
    }
  }
}

// Grant runtime identity read access to Key Vault secrets (RBAC mode).
var keyVaultSecretsUserRoleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')

resource keyVaultSecretsUserAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (enableKeyVaultRoleAssignment) {
  name: guid(keyVault.id, uami.id, keyVaultSecretsUserRoleDefinitionId)
  scope: keyVault
  properties: {
    roleDefinitionId: keyVaultSecretsUserRoleDefinitionId
    principalId: uami.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

output functionAppResourceName string = func.name
output functionAppDefaultHostName string = func.properties.defaultHostName
output storageAccountName string = storage.name
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
output identityClientId string = uami.properties.clientId
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output keyVaultRoleAssignmentEnabled bool = enableKeyVaultRoleAssignment
