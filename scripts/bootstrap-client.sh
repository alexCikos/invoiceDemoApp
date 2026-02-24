#!/usr/bin/env bash

set -euo pipefail

# Quick bootstrap for a brand-new client environment.
# Usage:
#   ./scripts/bootstrap-client.sh <subscription-id> <resource-group> <location> <name-prefix> [environment]

if [[ $# -lt 4 ]]; then
  echo "Usage: $0 <subscription-id> <resource-group> <location> <name-prefix> [environment]" >&2
  exit 1
fi

SUBSCRIPTION_ID="$1"
RESOURCE_GROUP="$2"
LOCATION="$3"
NAME_PREFIX="$4"
ENVIRONMENT_NAME="${5:-dev}"
DEPLOYMENT_NAME="bootstrap-${NAME_PREFIX}-${ENVIRONMENT_NAME}-$(date +%Y%m%d%H%M%S)"

for cmd in az; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Required command not found: $cmd" >&2
    exit 1
  fi
done

# Keep CLI output compact so only important values are printed.
export AZURE_CORE_OUTPUT=none

echo "Checking Azure login..."
if ! az account show >/dev/null 2>&1; then
  az login >/dev/null
fi

az account set --subscription "$SUBSCRIPTION_ID"

echo "Creating resource group: $RESOURCE_GROUP ($LOCATION)"
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" >/dev/null

echo "Deploying Bicep template: infra/main.bicep"
az deployment group create \
  --name "$DEPLOYMENT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --template-file infra/main.bicep \
  --parameters namePrefix="$NAME_PREFIX" environmentName="$ENVIRONMENT_NAME" location="$LOCATION" >/dev/null

FUNCTION_APP_NAME=$(az deployment group show \
  --name "$DEPLOYMENT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.outputs.functionAppResourceName.value" \
  --output tsv)

FUNCTION_HOST_NAME=$(az deployment group show \
  --name "$DEPLOYMENT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.outputs.functionAppDefaultHostName.value" \
  --output tsv)

IDENTITY_CLIENT_ID=$(az deployment group show \
  --name "$DEPLOYMENT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.outputs.identityClientId.value" \
  --output tsv)

KEY_VAULT_URI=$(az deployment group show \
  --name "$DEPLOYMENT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.outputs.keyVaultUri.value" \
  --output tsv)

cat <<SUMMARY

Bootstrap complete.

Deployment name: $DEPLOYMENT_NAME
Function App: $FUNCTION_APP_NAME
Function host: https://$FUNCTION_HOST_NAME
User-assigned identity clientId: $IDENTITY_CLIENT_ID
Key Vault URI: $KEY_VAULT_URI

Set these GitHub Environment variables (environment: $ENVIRONMENT_NAME):
- AZURE_CLIENT_ID=<deployment app registration client id>
- AZURE_TENANT_ID=<deployment app registration tenant id>
- AZURE_SUBSCRIPTION_ID=$SUBSCRIPTION_ID
- AZURE_RG=$RESOURCE_GROUP
- NAME_PREFIX=$NAME_PREFIX
- ENVIRONMENT_NAME=$ENVIRONMENT_NAME

Next:
1. Configure federated credential for your repo + environment in Entra ID.
2. Push to the $ENVIRONMENT_NAME branch policy target (for this template: dev).
SUMMARY
