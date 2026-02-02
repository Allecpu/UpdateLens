#!/bin/bash
# Setup Azure Easy Auth for UpdateLens
# This script should be run once to configure authentication
#
# Prerequisites:
# - Azure CLI installed and logged in (az login)
# - Sufficient permissions to create app registrations and configure App Service
#
# Usage: ./setup-easy-auth.sh

set -e

# Configuration
APP_SERVICE_NAME="updatelens-api"
RESOURCE_GROUP="rg-updatelens-runtime"
APP_DISPLAY_NAME="UpdateLens"
TENANT_ID="${AZURE_TENANT_ID:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}UpdateLens Easy Auth Setup${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if logged in to Azure
if ! az account show &>/dev/null; then
    echo -e "${RED}Error: Not logged in to Azure. Run 'az login' first.${NC}"
    exit 1
fi

# Get tenant ID if not set
if [ -z "$TENANT_ID" ]; then
    TENANT_ID=$(az account show --query tenantId -o tsv)
fi

echo -e "${YELLOW}Tenant ID: ${TENANT_ID}${NC}"
echo -e "${YELLOW}App Service: ${APP_SERVICE_NAME}${NC}"
echo -e "${YELLOW}Resource Group: ${RESOURCE_GROUP}${NC}"

# Get App Service hostname
APP_HOSTNAME=$(az webapp show \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query defaultHostName -o tsv)

if [ -z "$APP_HOSTNAME" ]; then
    echo -e "${RED}Error: Could not get App Service hostname${NC}"
    exit 1
fi

REDIRECT_URI="https://${APP_HOSTNAME}/.auth/login/aad/callback"
echo -e "${YELLOW}Redirect URI: ${REDIRECT_URI}${NC}"

# Check if app registration already exists
EXISTING_APP=$(az ad app list --display-name "$APP_DISPLAY_NAME" --query "[0].appId" -o tsv 2>/dev/null || echo "")

if [ -n "$EXISTING_APP" ]; then
    echo -e "${YELLOW}App registration already exists: ${EXISTING_APP}${NC}"
    CLIENT_ID="$EXISTING_APP"
else
    echo -e "${GREEN}Creating Entra ID app registration...${NC}"

    # Create app registration
    APP_CREATE_RESULT=$(az ad app create \
        --display-name "$APP_DISPLAY_NAME" \
        --sign-in-audience "AzureADMyOrg" \
        --web-redirect-uris "$REDIRECT_URI" \
        --enable-id-token-issuance true \
        --query "appId" -o tsv)

    CLIENT_ID="$APP_CREATE_RESULT"
    echo -e "${GREEN}Created app registration: ${CLIENT_ID}${NC}"

    # Wait for propagation
    echo "Waiting for app registration to propagate..."
    sleep 10
fi

# Create or update service principal
echo -e "${GREEN}Ensuring service principal exists...${NC}"
az ad sp create --id "$CLIENT_ID" 2>/dev/null || echo "Service principal already exists"

# Create client secret
echo -e "${GREEN}Creating client secret...${NC}"
SECRET_RESULT=$(az ad app credential reset \
    --id "$CLIENT_ID" \
    --display-name "EasyAuth-$(date +%Y%m%d)" \
    --years 2 \
    --query password -o tsv)

if [ -z "$SECRET_RESULT" ]; then
    echo -e "${RED}Error: Could not create client secret${NC}"
    exit 1
fi

echo -e "${GREEN}Client secret created (save this value!)${NC}"

# Configure Easy Auth on App Service
echo -e "${GREEN}Configuring Easy Auth on App Service...${NC}"

# Set auth settings v2
az webapp auth config-version upgrade \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" 2>/dev/null || echo "Already on auth v2"

# Configure Microsoft identity provider
az webapp auth microsoft update \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --client-id "$CLIENT_ID" \
    --client-secret "$SECRET_RESULT" \
    --issuer "https://login.microsoftonline.com/${TENANT_ID}/v2.0" \
    --yes

# Enable authentication
az webapp auth update \
    --name "$APP_SERVICE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --enabled true \
    --action RedirectToLoginPage \
    --unauthenticated-client-action RedirectToLoginPage

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Client ID: ${YELLOW}${CLIENT_ID}${NC}"
echo -e "Tenant ID: ${YELLOW}${TENANT_ID}${NC}"
echo -e "App URL:   ${YELLOW}https://${APP_HOSTNAME}${NC}"
echo ""
echo -e "${YELLOW}Important: Save these GitHub secrets:${NC}"
echo "  AZURE_AUTH_CLIENT_ID=${CLIENT_ID}"
echo "  AZURE_AUTH_CLIENT_SECRET=${SECRET_RESULT}"
echo ""
echo -e "${GREEN}Easy Auth is now configured. Users will be redirected to login.${NC}"
