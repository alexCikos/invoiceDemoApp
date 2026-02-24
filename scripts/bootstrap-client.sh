#!/usr/bin/env bash

set -euo pipefail

# Quick bootstrap for a brand-new client environment.
# This script intentionally deploys with environment parameter files so local bootstrap
# and GitHub Actions resolve the same Bicep values.
#
# Usage:
#   ./scripts/bootstrap-client.sh <environment> [subscription-id] [resource-group]
# Examples:
#   ./scripts/bootstrap-client.sh dev
#   ./scripts/bootstrap-client.sh prod
#   ./scripts/bootstrap-client.sh dev 00000000-0000-0000-0000-000000000000
#   ./scripts/bootstrap-client.sh prod 00000000-0000-0000-0000-000000000000 rg-acme-invoice-prod

if [[ $# -lt 1 || $# -gt 3 ]]; then
  echo "Usage: $0 <environment> [subscription-id] [resource-group]" >&2
  exit 1
fi

ENVIRONMENT_NAME="$1"
SUBSCRIPTION_ID="${2:-}"
RESOURCE_GROUP="${3:-}"
PARAM_FILE="infra/main.parameters.${ENVIRONMENT_NAME}.json"
TARGET_BRANCH="dev"

if [[ "$ENVIRONMENT_NAME" == "prod" ]]; then
  TARGET_BRANCH="main"
fi

if [[ "$ENVIRONMENT_NAME" != "dev" && "$ENVIRONMENT_NAME" != "prod" ]]; then
  echo "Unsupported environment: $ENVIRONMENT_NAME. Allowed: dev, prod." >&2
  exit 1
fi

if [[ ! -f "$PARAM_FILE" ]]; then
  echo "Parameter file not found: $PARAM_FILE" >&2
  exit 1
fi

for cmd in az node; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Required command not found: $cmd" >&2
    exit 1
  fi
done

# Read core values from the selected parameter file so bootstrap mirrors CI/CD.
LOCATION=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const v=p.parameters?.location?.value;if(!v){process.exit(2)};process.stdout.write(String(v));' "$PARAM_FILE" || true)
NAME_PREFIX=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const v=p.parameters?.namePrefix?.value;if(!v){process.exit(2)};process.stdout.write(String(v));' "$PARAM_FILE" || true)
PARAM_ENVIRONMENT_NAME=$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const v=p.parameters?.environmentName?.value;if(!v){process.exit(2)};process.stdout.write(String(v));' "$PARAM_FILE" || true)

if [[ -z "$LOCATION" || -z "$NAME_PREFIX" || -z "$PARAM_ENVIRONMENT_NAME" ]]; then
  echo "Parameter file must include parameters.location.value, parameters.namePrefix.value, and parameters.environmentName.value: $PARAM_FILE" >&2
  exit 1
fi

if [[ "$PARAM_ENVIRONMENT_NAME" != "$ENVIRONMENT_NAME" ]]; then
  echo "Environment mismatch: argument is '$ENVIRONMENT_NAME' but $PARAM_FILE sets environmentName='$PARAM_ENVIRONMENT_NAME'." >&2
  exit 1
fi

# Default RG naming follows the repo convention and comes from parameter-file values.
if [[ -z "$RESOURCE_GROUP" ]]; then
  RESOURCE_GROUP="rg-${NAME_PREFIX}-${ENVIRONMENT_NAME}"
fi

DEPLOYMENT_NAME="bootstrap-${NAME_PREFIX}-${ENVIRONMENT_NAME}-$(date +%Y%m%d%H%M%S)"

# Keep CLI output compact so only important values are printed.
export AZURE_CORE_OUTPUT=none

echo "Checking Azure login..."
if ! az account show >/dev/null 2>&1; then
  az login >/dev/null
fi

if [[ -n "$SUBSCRIPTION_ID" ]]; then
  az account set --subscription "$SUBSCRIPTION_ID"
else
  # If subscription isn't provided, use whichever subscription is already active in Azure CLI.
  SUBSCRIPTION_ID=$(az account show --query id --output tsv)
fi

echo "Creating resource group: $RESOURCE_GROUP ($LOCATION)"
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" >/dev/null

echo "Deploying Bicep template: infra/main.bicep"
az deployment group create \
  --name "$DEPLOYMENT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --template-file infra/main.bicep \
  --parameters "@${PARAM_FILE}" >/dev/null

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
Environment: $ENVIRONMENT_NAME
Parameter file: $PARAM_FILE
Name prefix: $NAME_PREFIX
Subscription: $SUBSCRIPTION_ID
Resource group: $RESOURCE_GROUP
Location: $LOCATION
Function App: $FUNCTION_APP_NAME
Function host: https://$FUNCTION_HOST_NAME
User-assigned identity clientId: $IDENTITY_CLIENT_ID
Key Vault URI: $KEY_VAULT_URI

Set these GitHub Environment variables (environment: $ENVIRONMENT_NAME):
- AZURE_CLIENT_ID=<deployment app registration client id>
- AZURE_TENANT_ID=<deployment app registration tenant id>
- AZURE_SUBSCRIPTION_ID=$SUBSCRIPTION_ID
- AZURE_RG=$RESOURCE_GROUP

Next:
1. Configure federated credential for your repo + environment in Entra ID.
2. Update the active parameter file when you need naming/tag/config changes: $PARAM_FILE.
3. Push/merge to the target branch for this environment: $TARGET_BRANCH.
SUMMARY
