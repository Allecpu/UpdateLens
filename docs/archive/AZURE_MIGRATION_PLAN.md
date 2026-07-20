# UpdateLens Azure Migration Plan (Target Region: Italy North)

## Executive Summary
- The current deployment is split across two regions: **West Europe** (`rg-updatelens`) and **Italy North** (`rg-updatelens-test`).
- All in-scope resources are **regional** and should be **recreated in Italy North** (no cross-region move in-place).
- Recommended target layout is **two Resource Groups in Italy North** to separate runtime from shared/data assets.
- Primary risks are **data copy for the Storage Account**, **App Insights/Log Analytics reconfiguration**, and **secret rotation** (Function keys, GitHub token).

## Current Inventory (discovered via Azure CLI)
| Resource Group | Name | Type | Region | Notes |
|---|---|---|---|---|
| rg-updatelens | updatelensdata | Microsoft.Storage/storageAccounts | West Europe | StorageV2, Standard_LRS |
| rg-updatelens | WestEuropePlan | Microsoft.Web/serverFarms | West Europe | Consumption (Y1), FunctionApp plan |
| rg-updatelens | updatelens-functions | Microsoft.Web/sites | West Europe | Function App (Node), System Assigned MI |
| rg-updatelens | updatelens-functions | Microsoft.Insights/components | West Europe | App Insights (linked to Default LA workspace in WEU) |
| rg-updatelens-test | plan-updatelens | Microsoft.Web/serverFarms | Italy North | App Service Plan (B1, Linux) |
| rg-updatelens-test | updatelens-api | Microsoft.Web/sites | Italy North | Web App (Linux, Node), System Assigned MI |
| rg-updatelens-test | oidc-msi-a4b7 | Microsoft.ManagedIdentity/userAssignedIdentities | Italy North | User Assigned MI, GitHub OIDC federation |

### Dependency Map (observed)
- **updatelens-functions** -> **WestEuropePlan** (appServicePlanId)
- **updatelens-functions** -> **updatelensdata** (AzureWebJobsStorage + WEBSITE_CONTENTAZUREFILECONNECTIONSTRING)
- **updatelens-functions** -> **updatelens-functions (App Insights)** (APPLICATIONINSIGHTS_CONNECTION_STRING)
- **updatelens-functions (App Insights)** -> **Default LA Workspace (West Europe)** (WorkspaceResourceId)
- **updatelens-api** -> **plan-updatelens** (appServicePlanId)
- **updatelens-api** -> **updatelens-functions** (AZURE_FUNCTION_URL + AZURE_FUNCTION_KEY)
- **oidc-msi-a4b7** -> **GitHub OIDC** (federated credential: repo `Allecpu/UpdateLens`, branch `Azure`)

## Classification (Move vs Recreate)
| Resource | Move vs Recreate | Downtime Impact | Risks / Prerequisites |
|---|---|---|---|
| Storage Account `updatelensdata` | Recreate in Italy North | Necessary (cutover) | Data copy + key rotation + update connection strings |
| App Service Plan `WestEuropePlan` | Recreate in Italy North | Minimal (new plan) | Ensure plan SKU supports Functions as required |
| Function App `updatelens-functions` | Recreate in Italy North | Necessary (cutover URL/key) | Recreate app settings, update storage + App Insights |
| App Insights `updatelens-functions` | Recreate in Italy North | Minimal | New Log Analytics workspace in Italy North |
| App Service Plan `plan-updatelens` | Keep (already Italy North) or Recreate in target RG | Minimal | If changing RG structure, recreate or move within region |
| Web App `updatelens-api` | Keep (already Italy North) or Recreate in target RG | Minimal/necessary (config) | Update function URL/key, secrets, CI/CD bindings |
| User Assigned MI `oidc-msi-a4b7` | Keep or Recreate in target RG | Minimal | Recreate federated credential if recreated |

## Resource Group Strategy (Decision)
### Option A: 1 Resource Group (Italy North)
**Pros**
- Simplest management and fewer IAM boundaries
- Easier scripting and fewer cross-RG references

**Cons**
- Mixed lifecycle for data + runtime
- Harder to separate costs and access controls

### Option B: 2 Resource Groups (Italy North) **(Recommended)**
- **rg-updatelens-runtime**: Function App, Web App, App Service Plans
- **rg-updatelens-shared**: Storage, App Insights, Log Analytics, Managed Identity

**Pros**
- Clear isolation for data/shared components
- Easier cost and permission separation
- Cleaner teardown of runtime without impacting data

**Cons**
- Slightly more complex IAM and scripting

**Decision**: **Option B** (2 RGs in Italy North) for clean separation and future scale.

## Migration Plan (Step-by-step, repeatable)
> Assumes final region is **Italy North** for all resources.

### 0) Preconditions
- Confirm target naming (RGs and resources).
- Confirm retention and compliance needs.
- Freeze changes during migration window.

### 1) Provision target Resource Groups (Italy North)
```bash
az group create -n rg-updatelens-runtime -l italynorth
az group create -n rg-updatelens-shared -l italynorth
```

### 2) Provision Shared/Data Resources in Italy North
```bash
# Storage account
az storage account create \
  -g rg-updatelens-shared -n updatelensdataitn \
  -l italynorth --sku Standard_LRS --kind StorageV2 \
  --allow-blob-public-access false --https-only true

# Create file share for Function App content (required for Consumption plan)
az storage share-rm create \
  -g rg-updatelens-shared --storage-account updatelensdataitn \
  -n updatelens-functions-content --quota 5

# Log Analytics workspace (Italy North)
az monitor log-analytics workspace create \
  -g rg-updatelens-shared -n updatelens-law \
  -l italynorth

# App Insights (using dedicated command instead of az resource create)
az monitor app-insights component create \
  -g rg-updatelens-shared -a updatelens-appinsights \
  -l italynorth --kind web --application-type web \
  --workspace /subscriptions/<SUB_ID>/resourceGroups/rg-updatelens-shared/providers/Microsoft.OperationalInsights/workspaces/updatelens-law

# User Assigned Managed Identity (for GitHub OIDC)
az identity create \
  -g rg-updatelens-shared -n oidc-updatelens-msi \
  -l italynorth

# Federated credential for GitHub OIDC (repo: Allecpu/UpdateLens, branch: Azure)
az identity federated-credential create \
  -g rg-updatelens-shared --identity-name oidc-updatelens-msi \
  -n github-oidc-credential \
  --issuer https://token.actions.githubusercontent.com \
  --subject repo:Allecpu/UpdateLens:ref:refs/heads/Azure \
  --audiences api://AzureADTokenExchange
```

### 3) Provision Runtime Resources in Italy North

> **⚠️ IMPORTANT**: The Web App name `updatelens-api` already exists in `rg-updatelens-test`.
> Azure Web App names are globally unique. You have two options:
> - **Option A**: Delete the old Web App first, then reuse the name
> - **Option B**: Use a new name (e.g., `updatelens-api-itn`) and update DNS/clients accordingly
>
> The commands below assume **Option A** (delete old first, then recreate with same name).

```bash
# ---------------------------------------------------------
# STEP 3.0: Delete old Web App to free up the name (Option A)
# ---------------------------------------------------------
# WARNING: Do this only after validating you have all config exported!
az webapp delete -g rg-updatelens-test -n updatelens-api

# Optionally delete the old App Service Plan if no longer needed
az appservice plan delete -g rg-updatelens-test -n plan-updatelens --yes

# ---------------------------------------------------------
# STEP 3.1: Function App Plan (Consumption, Linux)
# ---------------------------------------------------------
az functionapp plan create \
  -g rg-updatelens-runtime -n plan-updatelens-functions \
  -l italynorth --sku Y1 --is-linux

# ---------------------------------------------------------
# STEP 3.2: Function App
# ---------------------------------------------------------
az functionapp create \
  -g rg-updatelens-runtime -n updatelens-functions-itn \
  -p plan-updatelens-functions -s updatelensdataitn \
  --os-type Linux --functions-version 4 --runtime node --runtime-version 20

# ---------------------------------------------------------
# STEP 3.3: Web App Plan (Linux B1)
# ---------------------------------------------------------
az appservice plan create \
  -g rg-updatelens-runtime -n plan-updatelens-api \
  -l italynorth --sku B1 --is-linux

# ---------------------------------------------------------
# STEP 3.4: Web App (reusing name after deletion)
# ---------------------------------------------------------
az webapp create \
  -g rg-updatelens-runtime -n updatelens-api \
  -p plan-updatelens-api --runtime "NODE:20-lts"

# ---------------------------------------------------------
# STEP 3.5: Enable System Assigned Managed Identity on apps
# ---------------------------------------------------------
az functionapp identity assign -g rg-updatelens-runtime -n updatelens-functions-itn
az webapp identity assign -g rg-updatelens-runtime -n updatelens-api
```

### 4) Assign RBAC Roles (Cross-Resource Group Access)

> The Function App and Web App need access to the Storage Account in `rg-updatelens-shared`.
> Use RBAC roles instead of connection string keys for better security.

```bash
# Get the principal IDs of the System Assigned Managed Identities
FUNC_PRINCIPAL_ID=$(az functionapp identity show -g rg-updatelens-runtime -n updatelens-functions-itn --query principalId -o tsv)
WEBAPP_PRINCIPAL_ID=$(az webapp identity show -g rg-updatelens-runtime -n updatelens-api --query principalId -o tsv)

# Get Storage Account resource ID
STORAGE_ID=$(az storage account show -g rg-updatelens-shared -n updatelensdataitn --query id -o tsv)

# Assign "Storage Blob Data Contributor" to Function App (for blob read/write)
az role assignment create \
  --assignee $FUNC_PRINCIPAL_ID \
  --role "Storage Blob Data Contributor" \
  --scope $STORAGE_ID

# Assign "Storage File Data SMB Share Contributor" to Function App (for file share access)
az role assignment create \
  --assignee $FUNC_PRINCIPAL_ID \
  --role "Storage File Data SMB Share Contributor" \
  --scope $STORAGE_ID

# Assign "Storage Blob Data Reader" to Web App (if it needs blob access)
az role assignment create \
  --assignee $WEBAPP_PRINCIPAL_ID \
  --role "Storage Blob Data Reader" \
  --scope $STORAGE_ID

# Assign User Assigned MI role for GitHub Actions deployments
UAMI_PRINCIPAL_ID=$(az identity show -g rg-updatelens-shared -n oidc-updatelens-msi --query principalId -o tsv)

# Contributor on runtime RG (for deployments)
az role assignment create \
  --assignee $UAMI_PRINCIPAL_ID \
  --role "Contributor" \
  --scope /subscriptions/<SUB_ID>/resourceGroups/rg-updatelens-runtime

# Reader on shared RG (for config access)
az role assignment create \
  --assignee $UAMI_PRINCIPAL_ID \
  --role "Reader" \
  --scope /subscriptions/<SUB_ID>/resourceGroups/rg-updatelens-shared
```

### 5) Migrate Configuration (App Settings, Connection Strings)
- Export settings from current apps and **reapply** to new apps.
- **Rotate secrets**: do not copy plaintext secrets; regenerate keys and update consumers.

```bash
# ---------------------------------------------------------
# Export current settings (redact secrets before storing)
# ---------------------------------------------------------
az functionapp config appsettings list -g rg-updatelens -n updatelens-functions -o json > func-settings-backup.json
az webapp config appsettings list -g rg-updatelens-test -n updatelens-api -o json > webapp-settings-backup.json

# ---------------------------------------------------------
# Get connection strings for new resources
# ---------------------------------------------------------
# Storage connection string
STORAGE_CONN=$(az storage account show-connection-string \
  -g rg-updatelens-shared -n updatelensdataitn --query connectionString -o tsv)

# App Insights connection string
AI_CONN=$(az monitor app-insights component show \
  -g rg-updatelens-shared -a updatelens-appinsights --query connectionString -o tsv)

# ---------------------------------------------------------
# Apply settings to Function App
# ---------------------------------------------------------
az functionapp config appsettings set -g rg-updatelens-runtime -n updatelens-functions-itn --settings \
  FUNCTIONS_WORKER_RUNTIME=node \
  WEBSITE_NODE_DEFAULT_VERSION=~20 \
  FUNCTIONS_EXTENSION_VERSION=~4 \
  AzureWebJobsStorage="$STORAGE_CONN" \
  WEBSITE_CONTENTAZUREFILECONNECTIONSTRING="$STORAGE_CONN" \
  WEBSITE_CONTENTSHARE=updatelens-functions-content \
  APPLICATIONINSIGHTS_CONNECTION_STRING="$AI_CONN"

# ---------------------------------------------------------
# Get new Function App key (after deployment)
# ---------------------------------------------------------
# Note: Function keys are only available after code is deployed
# Deploy your function code first, then retrieve the key:
FUNC_KEY=$(az functionapp keys list -g rg-updatelens-runtime -n updatelens-functions-itn --query "functionKeys.default" -o tsv)

# ---------------------------------------------------------
# Apply settings to Web App
# ---------------------------------------------------------
az webapp config appsettings set -g rg-updatelens-runtime -n updatelens-api --settings \
  AZURE_FUNCTION_URL=https://updatelens-functions-itn.azurewebsites.net \
  AZURE_FUNCTION_KEY="$FUNC_KEY" \
  GITHUB_ISSUES_TOKEN=<ROTATE_AND_INSERT_NEW_TOKEN> \
  GITHUB_OWNER=Allecpu \
  GITHUB_REPO=UpdateLens \
  DB_PATH=/home/data \
  RELEASEPLANS_CRON="0 */6 * * *" \
  SCM_DO_BUILD_DURING_DEPLOYMENT=false \
  ENABLE_ORYX_BUILD=false \
  WEBSITE_NODE_DEFAULT_VERSION=~20
```

> **⚠️ Secret Rotation Reminder**:
> - Generate a **new GitHub Personal Access Token** with required scopes
> - Do NOT copy the old token; treat migration as an opportunity to rotate all secrets
> - Consider moving secrets to **Azure Key Vault** for better security

### 6) Backup SQLite Database (Web App)

> **⚠️ IMPORTANT**: The Web App uses SQLite at `/home/data/data.db`. This database contains release plan items, snapshots, and history. Back it up before any destructive operations.

```bash
# ---------------------------------------------------------
# Download current database from existing Web App
# ---------------------------------------------------------
# Option 1: Via Kudu API (SCM)
curl -X GET \
  -u '<deployment-username>:<deployment-password>' \
  "https://updatelens-api.scm.azurewebsites.net/api/vfs/data/data.db" \
  -o data.db.backup

# Option 2: Via Azure CLI (using webapp log download workaround)
az webapp log download -g rg-updatelens-test -n updatelens-api -o webapp-logs.zip
# Note: This downloads logs, not data. For data, use Kudu or SSH.

# Option 3: Via SSH (if enabled)
# 1. Enable SSH in Azure Portal for the Web App
# 2. Connect via: az webapp ssh -g rg-updatelens-test -n updatelens-api
# 3. Copy file: cat /home/data/data.db | base64 > /home/site/wwwroot/data.db.b64
# 4. Download via browser: https://updatelens-api.azurewebsites.net/data.db.b64

# ---------------------------------------------------------
# Restore to new Web App (after deployment)
# ---------------------------------------------------------
# Upload via Kudu API
curl -X PUT \
  -u '<deployment-username>:<deployment-password>' \
  --data-binary @data.db.backup \
  "https://updatelens-api.scm.azurewebsites.net/api/vfs/data/data.db"

# Or create the directory first if it doesn't exist
curl -X PUT \
  -u '<deployment-username>:<deployment-password>' \
  "https://updatelens-api.scm.azurewebsites.net/api/vfs/data/"
```

> **Note**: The database is in Italy North already (on `updatelens-api` in `rg-updatelens-test`). If reusing the same app name after deletion, the persistent storage `/home/data` may be lost. Always backup first.

### 7) Data Migration (Blob Storage)
- Copy Blob/File data from `updatelensdata` (West Europe) to `updatelensdataitn` (Italy North).
- Suggested tool: **AzCopy** for large/fast copy.

> **⚠️ Authentication Required**: AzCopy needs authentication. Options:
> - **Azure AD login** (recommended): `azcopy login`
> - **SAS tokens**: Generate read SAS on source, write SAS on destination

```bash
# ---------------------------------------------------------
# OPTION 1: Azure AD Login (recommended for interactive use)
# ---------------------------------------------------------
azcopy login

# ---------------------------------------------------------
# OPTION 2: Generate SAS tokens
# ---------------------------------------------------------
# Source SAS (read-only, valid 24h)
SOURCE_SAS=$(az storage account generate-sas \
  --account-name updatelensdata \
  --permissions rl --resource-types co --services bf \
  --expiry $(date -u -d '+24 hours' +%Y-%m-%dT%H:%MZ) -o tsv)

# Destination SAS (read-write, valid 24h)
DEST_SAS=$(az storage account generate-sas \
  --account-name updatelensdataitn \
  --permissions rwlac --resource-types co --services bf \
  --expiry $(date -u -d '+24 hours' +%Y-%m-%dT%H:%MZ) -o tsv)

# ---------------------------------------------------------
# Copy Blob containers
# ---------------------------------------------------------
# List containers in source to identify what to copy
az storage container list --account-name updatelensdata --query "[].name" -o tsv

# Sync each container (replace <container> with actual name)
azcopy sync \
  "https://updatelensdata.blob.core.windows.net/<container>?$SOURCE_SAS" \
  "https://updatelensdataitn.blob.core.windows.net/<container>?$DEST_SAS" \
  --recursive

# ---------------------------------------------------------
# Copy File shares (for function content)
# ---------------------------------------------------------
# List file shares in source
az storage share list --account-name updatelensdata --query "[].name" -o tsv

# Sync file share
azcopy sync \
  "https://updatelensdata.file.core.windows.net/<share>?$SOURCE_SAS" \
  "https://updatelensdataitn.file.core.windows.net/<share>?$DEST_SAS" \
  --recursive
```

> **Note for Windows**: Replace `$(date -u -d '+24 hours' +%Y-%m-%dT%H:%MZ)` with a manual date string like `2025-02-01T12:00Z`.

### 8) Validate
- Health checks on Function App and Web App.
- Validate API calls from Web App to Function App.
- Check logs and App Insights for errors.

### 9) Update GitHub Actions Workflows & Secrets

> **⚠️ CRITICAL**: The CI/CD pipelines must be updated to target the new resources. There are 3 workflows to update.

#### 9.1) Update GitHub Secrets

```bash
# ---------------------------------------------------------
# Get new values for GitHub Secrets
# ---------------------------------------------------------
# Subscription ID
az account show --query id -o tsv

# Tenant ID
az account show --query tenantId -o tsv

# User Assigned MI Client ID (for OIDC auth)
az identity show -g rg-updatelens-shared -n oidc-updatelens-msi --query clientId -o tsv

# Function App Publish Profile (if still using legacy auth)
az functionapp deployment list-publishing-profiles \
  -g rg-updatelens-runtime -n updatelens-functions-itn --xml
```

**GitHub Secrets to update** (Settings → Secrets and variables → Actions):

| Secret Name | New Value | Used By |
|-------------|-----------|---------|
| `AZUREAPPSERVICE_CLIENTID_*` | New MI Client ID | deploy-api.yml |
| `AZUREAPPSERVICE_TENANTID_*` | Tenant ID | deploy-api.yml |
| `AZUREAPPSERVICE_SUBSCRIPTIONID_*` | Subscription ID | deploy-api.yml |
| `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` | New publish profile (or migrate to OIDC) | deploy-functions.yml |

#### 9.2) Update `deploy-api.yml`

Change resource group and app name references:

```yaml
# OLD
env:
  AZURE_WEBAPP_NAME: updatelens-api
  RESOURCE_GROUP: rg-updatelens-test

# NEW
env:
  AZURE_WEBAPP_NAME: updatelens-api
  RESOURCE_GROUP: rg-updatelens-runtime
```

#### 9.3) Update `deploy-functions.yml`

**Option A: Keep Publish Profile (quick)**
```yaml
# Update app name only
- name: Deploy to Azure Functions
  uses: Azure/functions-action@v1
  with:
    app-name: 'updatelens-functions-itn'  # Changed from updatelens-functions
    package: './functions/deploy'
    publish-profile: ${{ secrets.AZURE_FUNCTIONAPP_PUBLISH_PROFILE }}
```

**Option B: Migrate to OIDC (recommended)**
```yaml
# Add OIDC login step (like deploy-api.yml)
- name: Login to Azure
  uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_FUNCTIONS_CLIENTID }}
    tenant-id: ${{ secrets.AZURE_FUNCTIONS_TENANTID }}
    subscription-id: ${{ secrets.AZURE_FUNCTIONS_SUBSCRIPTIONID }}

- name: Deploy to Azure Functions
  uses: Azure/functions-action@v1
  with:
    app-name: 'updatelens-functions-itn'
    package: './functions/deploy'
```

> **Note**: If migrating to OIDC for Functions, add a federated credential for the `main` branch (Functions deploy triggers on `main`):
> ```bash
> az identity federated-credential create \
>   -g rg-updatelens-shared --identity-name oidc-updatelens-msi \
>   -n github-oidc-main \
>   --issuer https://token.actions.githubusercontent.com \
>   --subject repo:Allecpu/UpdateLens:ref:refs/heads/main \
>   --audiences api://AzureADTokenExchange
> ```

#### 9.4) Update `refresh-data.yml`

This workflow commits to `main` and force-pushes to `Azure` branch. No Azure resource changes needed, but verify the branch trigger still works after migration.

### 10) Remove Redundant WebJob

> **⚠️ Note**: The project has a WebJob (`webjob/`) that triggers `refresh-data.yml` via GitHub API. This is **redundant** because:
> - Azure Functions already has a **Timer Trigger** (`refreshAllScheduled`) that runs on the same schedule
> - GitHub Actions `refresh-data.yml` also has a **cron trigger**

**Recommendation**: Remove the WebJob from deployment to avoid duplicate refresh executions.

```yaml
# In deploy-api.yml, remove or comment out these lines (around line 69-74):
# - name: Create WebJob structure
#   run: |
#     mkdir -p deploy/App_Data/jobs/triggered/refresh-data
#     cp webjob/* deploy/App_Data/jobs/triggered/refresh-data/
```

Alternatively, if you want to keep the WebJob as a backup trigger, ensure schedules don't overlap.

### 11) Cutover
- Update DNS/custom domains if present.
- Update CI/CD to deploy to new apps (see step 9).
- Lock old apps (stop or restrict access).

### 12) Decommission (after validation window)
- Remove old resources in West Europe once stable.
- Delete old resource groups:
  ```bash
  # Only after validation passes!
  az group delete -n rg-updatelens --yes --no-wait
  az group delete -n rg-updatelens-test --yes --no-wait
  ```

## Rollback Plan
- Keep old West Europe resources intact until validation passes.
- Revert DNS to old endpoints if needed.
- Restore old app settings and re-enable old apps.

## Go-live Checklist

### Azure Resources
- [ ] All resources provisioned in Italy North
- [ ] Function App responds correctly (`/api/health` or test HTTP trigger)
- [ ] Web App routes to new Function endpoint
- [ ] App Insights receiving telemetry in Italy North workspace
- [ ] Storage reads/writes verified post-migration
- [ ] SQLite database restored and accessible
- [ ] RBAC roles assigned correctly (cross-RG access working)

### CI/CD & Secrets
- [ ] GitHub Secrets updated (Client ID, Tenant ID, Subscription ID)
- [ ] `deploy-api.yml` updated to target `rg-updatelens-runtime`
- [ ] `deploy-functions.yml` updated to target `updatelens-functions-itn`
- [ ] Functions auth migrated to OIDC (or publish profile updated)
- [ ] Federated credentials created for both `Azure` and `main` branches
- [ ] Test deployment from GitHub Actions succeeds

### Security
- [ ] GitHub token rotated (new PAT generated)
- [ ] Old token in `.env` file invalidated
- [ ] `.env` file removed from version control (add to `.gitignore`)
- [ ] Function keys regenerated
- [ ] Storage keys rotated (if using connection strings)
- [ ] Consider moving secrets to Azure Key Vault

### Cleanup
- [ ] WebJob removed from deployment (or schedule verified non-overlapping)
- [ ] Old West Europe resources stopped/locked
- [ ] Old resource groups deleted (after validation window)

## Security & Compliance Notes

### 🚨 CRITICAL: Token Exposed in Version Control

The file `.env` in the repository root contains a **GitHub Personal Access Token in plaintext**:
```
GITHUB_TOKEN=github_pat_11BKB2QQQ...
```

**Immediate actions required:**
1. **Revoke the token** immediately in GitHub Settings → Developer settings → Personal access tokens
2. **Generate a new token** with minimum required scopes
3. **Add `.env` to `.gitignore`** to prevent future commits
4. **Remove `.env` from git history** (optional but recommended):
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env" \
     --prune-empty --tag-name-filter cat -- --all
   git push origin --force --all
   ```
5. **Store the new token** in Azure Key Vault or GitHub Secrets only

### Secrets Management

| Secret | Current Location | Recommended Location |
|--------|------------------|---------------------|
| GitHub PAT | `.env` (exposed!), App Settings | Azure Key Vault |
| Function Key | App Settings | Key Vault or Managed Identity |
| Storage Connection String | App Settings | Key Vault or use Managed Identity RBAC |
| App Insights Connection String | App Settings | OK (not sensitive) |

### Key Vault Integration (Optional but Recommended)

```bash
# Create Key Vault
az keyvault create \
  -g rg-updatelens-shared -n kv-updatelens \
  -l italynorth --enable-rbac-authorization

# Grant Web App access to Key Vault
WEBAPP_PRINCIPAL=$(az webapp identity show -g rg-updatelens-runtime -n updatelens-api --query principalId -o tsv)
KV_ID=$(az keyvault show -n kv-updatelens --query id -o tsv)

az role assignment create \
  --assignee $WEBAPP_PRINCIPAL \
  --role "Key Vault Secrets User" \
  --scope $KV_ID

# Store secrets
az keyvault secret set --vault-name kv-updatelens -n github-token --value "<NEW_TOKEN>"
az keyvault secret set --vault-name kv-updatelens -n function-key --value "<FUNC_KEY>"

# Reference from App Settings (Key Vault reference syntax)
az webapp config appsettings set -g rg-updatelens-runtime -n updatelens-api --settings \
  GITHUB_ISSUES_TOKEN="@Microsoft.KeyVault(VaultName=kv-updatelens;SecretName=github-token)"
```

### Other Security Notes
- System Assigned MIs exist on apps; ensure role assignments are recreated on new resources
- GitHub OIDC federated credential exists for `oidc-msi-a4b7`; recreated as `oidc-updatelens-msi` in migration
- Consider enabling **Private Endpoints** for Storage and Key Vault in production

## Estimated Timing / Impact (Qualitative)
- **Provisioning**: 1–2 hours
- **Configuration migration**: 1–2 hours
- **Data migration**: depends on storage size (minutes to hours)
- **Cutover downtime**: likely **short but necessary** (minutes) unless dual-write is implemented
- **Validation**: 1–2 hours

## Appendix: Workflow File Changes

### A.1) Changes to `.github/workflows/deploy-api.yml`

```diff
# Line 122-124: Update secrets (or keep same names, just update values in GitHub)
- client-id: ${{ secrets.AZUREAPPSERVICE_CLIENTID_3657520D6E074B449CAC38EFA4EF8865 }}
- tenant-id: ${{ secrets.AZUREAPPSERVICE_TENANTID_53ABC2563A1D4368A6B5EEC80EB3401A }}
- subscription-id: ${{ secrets.AZUREAPPSERVICE_SUBSCRIPTIONID_DD0E651561084DFDB83AFFB2EE78E235 }}
+ client-id: ${{ secrets.AZURE_CLIENT_ID }}
+ tenant-id: ${{ secrets.AZURE_TENANT_ID }}
+ subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

# Line 137, 148, 155: Update resource group
- --resource-group rg-updatelens-test \
+ --resource-group rg-updatelens-runtime \

# Lines 69-74 (optional): Remove WebJob creation
- # Create WebJob structure
- mkdir -p deploy/App_Data/jobs/triggered/refresh-data
- cp webjob/* deploy/App_Data/jobs/triggered/refresh-data/ || true
```

### A.2) Changes to `.github/workflows/deploy-functions.yml`

```diff
# Update app name in deploy step
- app-name: 'updatelens-functions'
+ app-name: 'updatelens-functions-itn'

# Optional: Migrate to OIDC (add before deploy step)
+ - name: Login to Azure
+   uses: azure/login@v2
+   with:
+     client-id: ${{ secrets.AZURE_CLIENT_ID }}
+     tenant-id: ${{ secrets.AZURE_TENANT_ID }}
+     subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

# If using OIDC, remove publish-profile line
- publish-profile: ${{ secrets.AZURE_FUNCTIONAPP_PUBLISH_PROFILE }}
```

### A.3) New GitHub Secrets to Create

| Secret Name | Value | Notes |
|-------------|-------|-------|
| `AZURE_CLIENT_ID` | Output of `az identity show -g rg-updatelens-shared -n oidc-updatelens-msi --query clientId -o tsv` | User Assigned MI |
| `AZURE_TENANT_ID` | Output of `az account show --query tenantId -o tsv` | Azure AD Tenant |
| `AZURE_SUBSCRIPTION_ID` | Output of `az account show --query id -o tsv` | Azure Subscription |

> **Note**: You can keep the old secret names (with the random suffixes) and just update their values, or rename them for clarity.

---

## Attention Points

### Pre-Migration
- [ ] **Backup SQLite database** from `/home/data/data.db` before deleting Web App
- [ ] **Export all app settings** from both Function App and Web App
- [ ] **Revoke exposed GitHub token** in `.env` immediately
- [ ] **Verify blob container contents** in source storage account

### During Migration
- [ ] App Insights currently uses the default WEU Log Analytics workspace; a new Italy North workspace is required
- [ ] Function App storage connection strings must be updated to the new storage account
- [ ] Web App name `updatelens-api` is globally unique - delete old before creating new
- [ ] Function App name changed to `updatelens-functions-itn` - update all references

### Post-Migration
- [ ] Update GitHub Actions workflows to target new resources
- [ ] Update GitHub Secrets with new credentials
- [ ] Remove WebJob from deployment or verify non-overlapping schedules
- [ ] Rotate and secure secrets; move to Azure Key Vault
- [ ] Test full data refresh cycle (GitHub Actions → Functions → Storage → Web App)
- [ ] Verify Timer Trigger Function fires correctly on schedule
