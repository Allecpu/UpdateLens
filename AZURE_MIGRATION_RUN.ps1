# UpdateLens Azure Migration - scripted runbook (PowerShell)
# Target region: Italy North
# NOTE: This file is a runbook. Some steps require manual input or credentials.

$ErrorActionPreference = 'Stop'

# -------- Settings --------
$Region = 'italynorth'
$RGRuntime = 'rg-updatelens-runtime'
$RGShared = 'rg-updatelens-shared'

$StorageName = 'updatelensdataitn'
$FileShareName = 'updatelens-functions-content'

$LogAnalyticsName = 'updatelens-law'
$AppInsightsName = 'updatelens-appinsights'

$UAMIName = 'oidc-updatelens-msi'

$FunctionPlan = 'plan-updatelens-functions'
$FunctionApp = 'updatelens-functions-itn'

$WebPlan = 'plan-updatelens-api'
$WebApp = 'updatelens-api'

# Old resources (for export/backup/delete)
$OldFuncRG = 'rg-updatelens'
$OldFuncApp = 'updatelens-functions'
$OldWebRG = 'rg-updatelens-test'
$OldWebApp = 'updatelens-api'
$OldWebPlan = 'plan-updatelens'

# -------- Step 0: Verify account --------
az account show

# -------- Step 1: Export current app settings (contains secrets) --------
$MigrationDir = Join-Path $PSScriptRoot '_migration'
New-Item -ItemType Directory -Force -Path $MigrationDir | Out-Null
az functionapp config appsettings list -g $OldFuncRG -n $OldFuncApp -o json | Out-File (Join-Path $MigrationDir 'func-settings-backup.json') -Encoding utf8
az webapp config appsettings list -g $OldWebRG -n $OldWebApp -o json | Out-File (Join-Path $MigrationDir 'webapp-settings-backup.json') -Encoding utf8

# -------- Step 2: Backup SQLite DB (manual) --------
# Backup /home/data/data.db BEFORE deleting the old web app.
# Use Kudu (SCM) or SSH to download and keep a local copy.

# -------- Step 3: Create resource groups --------
az group create -n $RGRuntime -l $Region
az group create -n $RGShared -l $Region

# -------- Step 4: Shared resources --------
# Storage account
az storage account create -g $RGShared -n $StorageName -l $Region --sku Standard_LRS --kind StorageV2 --allow-blob-public-access false --https-only true

# File share for Functions content
az storage share-rm create -g $RGShared --storage-account $StorageName -n $FileShareName --quota 5

# Log Analytics workspace
az monitor log-analytics workspace create -g $RGShared -n $LogAnalyticsName -l $Region
$LA_ID = az monitor log-analytics workspace show -g $RGShared -n $LogAnalyticsName --query id -o tsv

# App Insights (linked to LA workspace)
az monitor app-insights component create -g $RGShared -a $AppInsightsName -l $Region --kind web --application-type web --workspace $LA_ID

# User Assigned Managed Identity for GitHub OIDC
az identity create -g $RGShared -n $UAMIName -l $Region

# Federated credential for GitHub OIDC (branch: Azure)
az identity federated-credential create -g $RGShared --identity-name $UAMIName -n github-oidc-credential --issuer https://token.actions.githubusercontent.com --subject repo:Allecpu/UpdateLens:ref:refs/heads/Azure --audiences api://AzureADTokenExchange

# Optional: add federated credential for main branch (if deploying Functions from main)
# az identity federated-credential create -g $RGShared --identity-name $UAMIName -n github-oidc-main --issuer https://token.actions.githubusercontent.com --subject repo:Allecpu/UpdateLens:ref:refs/heads/main --audiences api://AzureADTokenExchange

# -------- Step 5: Runtime resources --------
# IMPORTANT: delete old web app first if reusing name (Option A)
# az webapp delete -g $OldWebRG -n $OldWebApp
# Optional: delete old plan if unused
# az appservice plan delete -g $OldWebRG -n $OldWebPlan --yes

# Function App plan (Dedicated, Linux B1)
az functionapp plan create -g $RGRuntime -n $FunctionPlan -l $Region --sku B1 --is-linux

# Function App (Dedicated)
$StorageId = az storage account show -g $RGShared -n $StorageName --query id -o tsv
az functionapp create -g $RGRuntime -n $FunctionApp -p $FunctionPlan -s $StorageId --os-type Linux --functions-version 4 --runtime node --runtime-version 20

# Web App plan
az appservice plan create -g $RGRuntime -n $WebPlan -l $Region --sku B1 --is-linux

# Web App (reusing name after deletion)
az webapp create -g $RGRuntime -n $WebApp -p $WebPlan --runtime "NODE:20-lts"

# Enable system-assigned identities
az functionapp identity assign -g $RGRuntime -n $FunctionApp
az webapp identity assign -g $RGRuntime -n $WebApp

# -------- Step 6: RBAC (cross-RG access) --------
$FUNC_PRINCIPAL_ID = az functionapp identity show -g $RGRuntime -n $FunctionApp --query principalId -o tsv
$WEBAPP_PRINCIPAL_ID = az webapp identity show -g $RGRuntime -n $WebApp --query principalId -o tsv
$STORAGE_ID = az storage account show -g $RGShared -n $StorageName --query id -o tsv

az role assignment create --assignee $FUNC_PRINCIPAL_ID --role "Storage Blob Data Contributor" --scope $STORAGE_ID
az role assignment create --assignee $FUNC_PRINCIPAL_ID --role "Storage File Data SMB Share Contributor" --scope $STORAGE_ID
az role assignment create --assignee $WEBAPP_PRINCIPAL_ID --role "Storage Blob Data Reader" --scope $STORAGE_ID

$UAMI_PRINCIPAL_ID = az identity show -g $RGShared -n $UAMIName --query principalId -o tsv
$SUB_ID = az account show --query id -o tsv
az role assignment create --assignee $UAMI_PRINCIPAL_ID --role "Contributor" --scope "/subscriptions/$SUB_ID/resourceGroups/$RGRuntime"
az role assignment create --assignee $UAMI_PRINCIPAL_ID --role "Reader" --scope "/subscriptions/$SUB_ID/resourceGroups/$RGShared"

# -------- Step 7: App settings --------
$STORAGE_CONN = az storage account show-connection-string -g $RGShared -n $StorageName --query connectionString -o tsv
$AI_CONN = az monitor app-insights component show -g $RGShared -a $AppInsightsName --query connectionString -o tsv

# Function App settings
az functionapp config appsettings set -g $RGRuntime -n $FunctionApp --settings `
  FUNCTIONS_WORKER_RUNTIME=node `
  WEBSITE_NODE_DEFAULT_VERSION=~20 `
  FUNCTIONS_EXTENSION_VERSION=~4 `
  AzureWebJobsStorage="$STORAGE_CONN" `
  WEBSITE_CONTENTAZUREFILECONNECTIONSTRING="$STORAGE_CONN" `
  WEBSITE_CONTENTSHARE=$FileShareName `
  APPLICATIONINSIGHTS_CONNECTION_STRING="$AI_CONN"

# Deploy Function App code BEFORE retrieving keys
# Then:
# $FUNC_KEY = az functionapp keys list -g $RGRuntime -n $FunctionApp --query "functionKeys.default" -o tsv

# Web App settings (replace placeholders)
# az webapp config appsettings set -g $RGRuntime -n $WebApp --settings `
#   AZURE_FUNCTION_URL="https://$FunctionApp.azurewebsites.net" `
#   AZURE_FUNCTION_KEY="<FUNC_KEY>" `
#   GITHUB_ISSUES_TOKEN="<ROTATE_AND_INSERT_NEW_TOKEN>" `
#   GITHUB_OWNER=Allecpu `
#   GITHUB_REPO=UpdateLens `
#   DB_PATH=/home/data `
#   RELEASEPLANS_CRON="0 */6 * * *" `
#   SCM_DO_BUILD_DURING_DEPLOYMENT=false `
#   ENABLE_ORYX_BUILD=false `
#   WEBSITE_NODE_DEFAULT_VERSION=~20

# -------- Step 8: Data migration (AzCopy) --------
# azcopy login
# $expiry = (Get-Date).ToUniversalTime().AddHours(24).ToString('yyyy-MM-ddTHH:mmZ')
# $SOURCE_SAS = az storage account generate-sas --account-name updatelensdata --permissions rl --resource-types co --services bf --expiry $expiry -o tsv
# $DEST_SAS = az storage account generate-sas --account-name $StorageName --permissions rwlac --resource-types co --services bf --expiry $expiry -o tsv
# az storage container list --account-name updatelensdata --query "[].name" -o tsv
# azcopy sync "https://updatelensdata.blob.core.windows.net/<container>?$SOURCE_SAS" "https://$StorageName.blob.core.windows.net/<container>?$DEST_SAS" --recursive
# az storage share list --account-name updatelensdata --query "[].name" -o tsv
# azcopy sync "https://updatelensdata.file.core.windows.net/<share>?$SOURCE_SAS" "https://$StorageName.file.core.windows.net/<share>?$DEST_SAS" --recursive

# -------- Step 9: CI/CD updates --------
# Update GitHub Secrets and workflows per AZURE_MIGRATION_PLAN.md (manual step).

# -------- Step 10: Cutover/cleanup --------
# Follow validation + decommission steps after successful verification.
