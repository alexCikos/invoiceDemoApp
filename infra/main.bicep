targetScope = 'resourceGroup'

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Prefix for all resource names. Use letters/numbers and optional hyphens.')
@minLength(2)
@maxLength(20)
param namePrefix string

// Normalize the prefix once so resource naming is predictable and reusable.
var normalizedPrefix = toLower(replace(replace(namePrefix, '-', ''), '_', ''))
var suffix = uniqueString(resourceGroup().id)

// Storage account name rules: 3-24 chars, lowercase + numbers only (no hyphens).
// Keep max 9 chars from prefix because "sa" + 9 + 13-char suffix = 24 chars.
var storageName = 'sa${take(normalizedPrefix, 9)}${suffix}'

// Function App name: globally unique
var functionAppName = toLower('func-${take(namePrefix, 20)}-${suffix}')

var uamiName = toLower('${take(namePrefix, 20)}-uami')

// ---- Storage (required for Functions) ----
resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

// ---- Hosting plan (Consumption / serverless) ----
resource plan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '${namePrefix}-asp'
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {
    reserved: true // required for Linux
  }
}

// ---- User Assigned Managed Identity (stable identity for future RBAC) ----
resource uami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: uamiName
  location: location
}

// ---- Function App (Linux) ----
resource func 'Microsoft.Web/sites@2023-01-01' = {
  name: functionAppName
  location: location
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
    siteConfig: {
      ftpsState: 'Disabled'
      linuxFxVersion: 'Node|20'
      appSettings: [
        // Host storage using connection string (works with Core Tools and GitHub Actions deploy)
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
        }

        // Functions runtime version
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }

        // Node worker
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }

        // Standard package/zip deployment mode (works well with GitHub Actions)
        { name: 'WEBSITE_RUN_FROM_PACKAGE', value: '1' }
      ]
    }
  }
}

output storageAccountName string = storage.name
output functionAppResourceName string = func.name
output identityClientId string = uami.properties.clientId
