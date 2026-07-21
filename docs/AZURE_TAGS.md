# Azure Resource Tags - Standardization Plan

**Project**: UpdateLens  
**Date**: 2026-02-02  
**Priority**: High  
**Effort**: 4-6 hours  
**Impact**: Governance, Cost Management, Ownership, Auditing

---

## Obiettivo

Implementare un sistema di **tagging standardizzato** per tutte le risorse Azure di UpdateLens, migliorando:
- 📊 **Cost Management** - Tracking costi per ambiente/progetto
- 👥 **Ownership** - Chiara identificazione responsabili
- 🔍 **Auditing** - Tracciabilità modifiche e deployment
- 🏛️ **Governance** - Compliance con policy aziendali

---

## Scope

### Risorse da Taggare

#### Resource Groups
- `rg-updatelens-runtime` (Italy North)
- `rg-updatelens-shared` (Italy North)
- `rg-updatelens` (West Europe) - Se ancora esistente, da deprecare
- `rg-updatelens-test` (Italy North/West Europe) - Se ancora esistente

#### Risorse Runtime (`rg-updatelens-runtime`)
- **Azure App Service**: `updatelens-api`
- **Azure Functions**: `updatelens-functions-itn`
- **App Service Plan (Functions)**: `plan-updatelens-functions`
- **App Service Plan (Web App)**: `plan-updatelens-api`

#### Risorse Shared (`rg-updatelens-shared`)
- **Storage Account**: `updatelensdataitn`
- **Application Insights**: `updatelens-appinsights`
- **Log Analytics Workspace**: `updatelens-law`
- **User Assigned Managed Identity**: `oidc-updatelens-msi`

#### Risorse Future (quando create)
- **Azure Key Vault**: `kv-updatelens`
- **Cosmos DB**: `cosmos-updatelens`
- **Private Endpoints**: vari

---

## Tag Schema

### Tags Standard (Obbligatori)

| Tag Name | Valori Possibili | Descrizione | Esempio |
|----------|------------------|-------------|---------|
| `Environment` | `Production`, `Staging`, `Development`, `Test` | Ambiente deployment | `Production` |
| `Project` | `UpdateLens` | Nome progetto | `UpdateLens` |
| `Owner` | Email o nome team | Responsabile risorsa | `alessandro.levantini@css.it` |
| `CostCenter` | Codice centro di costo | Per chargeback | `IT-INFRA-001` |
| `ManagedBy` | `Terraform`, `ARM`, `Manual`, `GitHub-Actions` | Modalità gestione | `GitHub-Actions` |
| `DeployedBy` | `CI/CD`, `Manual`, `Script` | Modalità deployment | `CI/CD` |
| `Version` | Semantic version | Versione applicazione | `0.5.0` |

### Tags Opzionali (Consigliati)

| Tag Name | Valori Possibili | Descrizione | Esempio |
|----------|------------------|-------------|---------|
| `Application` | Nome applicazione | Componente applicativo | `UpdateLens-API` |
| `DataClassification` | `Public`, `Internal`, `Confidential`, `Restricted` | Classificazione dati | `Internal` |
| `Criticality` | `Critical`, `High`, `Medium`, `Low` | Criticità business | `High` |
| `MaintenanceWindow` | Giorni/ore | Finestra manutenzione | `Sunday-02:00-04:00` |
| `BackupPolicy` | Nome policy | Policy backup | `Daily-7days` |
| `ComplianceRequirement` | Standard compliance | Requisiti compliance | `GDPR` |

---

## Valori Proposti per UpdateLens

### Resource Groups

#### `rg-updatelens-runtime`
```json
{
  "Environment": "Production",
  "Project": "UpdateLens",
  "Owner": "alessandro.levantini@css.it",
  "CostCenter": "IT-INFRA-001",
  "ManagedBy": "GitHub-Actions",
  "DeployedBy": "CI/CD",
  "Version": "0.5.0",
  "Application": "UpdateLens-Runtime",
  "Criticality": "High"
}
```

#### `rg-updatelens-shared`
```json
{
  "Environment": "Production",
  "Project": "UpdateLens",
  "Owner": "alessandro.levantini@css.it",
  "CostCenter": "IT-INFRA-001",
  "ManagedBy": "GitHub-Actions",
  "DeployedBy": "CI/CD",
  "Version": "0.5.0",
  "Application": "UpdateLens-Shared",
  "Criticality": "High"
}
```

### Risorse Individuali

Tutte le risorse ereditano i tag dal Resource Group, con override specifici dove necessario:

**Web App** (`updatelens-api`):
```json
{
  "Application": "UpdateLens-WebApp",
  "DataClassification": "Internal"
}
```

**Functions** (`updatelens-functions-itn`):
```json
{
  "Application": "UpdateLens-Functions",
  "MaintenanceWindow": "Sunday-02:00-04:00"
}
```

**Storage Account** (`updatelensdataitn`):
```json
{
  "Application": "UpdateLens-Storage",
  "DataClassification": "Internal",
  "BackupPolicy": "Snapshot-Versioning"
}
```

---

## Implementazione

### Approccio

1. **Tag Resource Groups** - Applicare tags ai RG (ereditati da risorse)
2. **Tag Risorse Individuali** - Override/aggiunta tags specifici
3. **Modalità Update** - Merge (non overwrite) per preservare tags esistenti
4. **Validation** - Verificare applicazione corretta
5. **Policy Enforcement** - Creare Azure Policy per enforcement futuro

### Script PowerShell

#### 1. Tag Resource Groups

```powershell
# Azure Resource Tags - UpdateLens
# Author: Alessandro Levantini
# Date: 2026-02-02

# Login Azure (se necessario)
# az login

# Variabili comuni
$commonTags = @{
    "Environment" = "Production"
    "Project" = "UpdateLens"
    "Owner" = "alessandro.levantini@css.it"
    "CostCenter" = "IT-INFRA-001"
    "ManagedBy" = "GitHub-Actions"
    "DeployedBy" = "CI/CD"
    "Version" = "0.5.0"
}

# Tag Resource Group - Runtime
$runtimeTags = $commonTags.Clone()
$runtimeTags["Application"] = "UpdateLens-Runtime"
$runtimeTags["Criticality"] = "High"

az tag create `
  --resource-id "/subscriptions/<SUBSCRIPTION_ID>/resourceGroups/rg-updatelens-runtime" `
  --tags $runtimeTags `
  --operation Merge

Write-Host "✅ Tagged: rg-updatelens-runtime" -ForegroundColor Green

# Tag Resource Group - Shared
$sharedTags = $commonTags.Clone()
$sharedTags["Application"] = "UpdateLens-Shared"
$sharedTags["Criticality"] = "High"

az tag create `
  --resource-id "/subscriptions/<SUBSCRIPTION_ID>/resourceGroups/rg-updatelens-shared" `
  --tags $sharedTags `
  --operation Merge

Write-Host "✅ Tagged: rg-updatelens-shared" -ForegroundColor Green
```

#### 2. Tag Risorse Individuali

```powershell
# Tag Web App
$webAppId = az webapp show -g rg-updatelens-runtime -n updatelens-api --query id -o tsv
$webAppTags = @{
    "Application" = "UpdateLens-WebApp"
    "DataClassification" = "Internal"
}

az tag create --resource-id $webAppId --tags $webAppTags --operation Merge
Write-Host "✅ Tagged: updatelens-api" -ForegroundColor Green

# Tag Functions
$funcId = az functionapp show -g rg-updatelens-runtime -n updatelens-functions-itn --query id -o tsv
$funcTags = @{
    "Application" = "UpdateLens-Functions"
    "MaintenanceWindow" = "Sunday-02:00-04:00"
}

az tag create --resource-id $funcId --tags $funcTags --operation Merge
Write-Host "✅ Tagged: updatelens-functions-itn" -ForegroundColor Green

# Tag Storage Account
$storageId = az storage account show -g rg-updatelens-shared -n updatelensdataitn --query id -o tsv
$storageTags = @{
    "Application" = "UpdateLens-Storage"
    "DataClassification" = "Internal"
    "BackupPolicy" = "Snapshot-Versioning"
}

az tag create --resource-id $storageId --tags $storageTags --operation Merge
Write-Host "✅ Tagged: updatelensdataitn" -ForegroundColor Green

# Tag Application Insights
$appInsightsId = az monitor app-insights component show -g rg-updatelens-shared -a updatelens-appinsights --query id -o tsv
$appInsightsTags = @{
    "Application" = "UpdateLens-Monitoring"
}

az tag create --resource-id $appInsightsId --tags $appInsightsTags --operation Merge
Write-Host "✅ Tagged: updatelens-appinsights" -ForegroundColor Green

# Tag Log Analytics Workspace
$lawId = az monitor log-analytics workspace show -g rg-updatelens-shared -n updatelens-law --query id -o tsv
$lawTags = @{
    "Application" = "UpdateLens-Logging"
}

az tag create --resource-id $lawId --tags $lawTags --operation Merge
Write-Host "✅ Tagged: updatelens-law" -ForegroundColor Green

# Tag Managed Identity
$miId = az identity show -g rg-updatelens-shared -n oidc-updatelens-msi --query id -o tsv
$miTags = @{
    "Application" = "UpdateLens-Identity"
    "ManagedBy" = "GitHub-OIDC"
}

az tag create --resource-id $miId --tags $miTags --operation Merge
Write-Host "✅ Tagged: oidc-updatelens-msi" -ForegroundColor Green

Write-Host "`n🎉 Tagging completato!" -ForegroundColor Cyan
```

#### 3. Script Completo con Funzioni

```powershell
# azure-tags-apply.ps1
# Applicazione tags standardizzati a risorse UpdateLens

param(
    [Parameter(Mandatory=$true)]
    [string]$SubscriptionId,
    
    [Parameter(Mandatory=$false)]
    [switch]$WhatIf
)

function Apply-Tags {
    param(
        [string]$ResourceId,
        [hashtable]$Tags,
        [string]$ResourceName
    )
    
    if ($WhatIf) {
        Write-Host "WHATIF: Would tag $ResourceName" -ForegroundColor Yellow
        $Tags.GetEnumerator() | ForEach-Object {
            Write-Host "  $($_.Key) = $($_.Value)" -ForegroundColor Gray
        }
    } else {
        try {
            az tag create --resource-id $ResourceId --tags $Tags --operation Merge --output none
            Write-Host "✅ Tagged: $ResourceName" -ForegroundColor Green
        } catch {
            Write-Host "❌ Failed to tag: $ResourceName" -ForegroundColor Red
            Write-Host "   Error: $_" -ForegroundColor Red
        }
    }
}

# Common tags
$commonTags = @{
    "Environment" = "Production"
    "Project" = "UpdateLens"
    "Owner" = "alessandro.levantini@css.it"
    "CostCenter" = "IT-INFRA-001"
    "ManagedBy" = "GitHub-Actions"
    "DeployedBy" = "CI/CD"
    "Version" = "0.5.0"
}

Write-Host "Starting Azure Resource Tagging for UpdateLens..." -ForegroundColor Cyan
Write-Host "Subscription: $SubscriptionId" -ForegroundColor Cyan

# Resource Groups
$rgRuntime = "/subscriptions/$SubscriptionId/resourceGroups/rg-updatelens-runtime"
$rgShared = "/subscriptions/$SubscriptionId/resourceGroups/rg-updatelens-shared"

$runtimeTags = $commonTags.Clone()
$runtimeTags["Application"] = "UpdateLens-Runtime"
$runtimeTags["Criticality"] = "High"
Apply-Tags -ResourceId $rgRuntime -Tags $runtimeTags -ResourceName "rg-updatelens-runtime"

$sharedTags = $commonTags.Clone()
$sharedTags["Application"] = "UpdateLens-Shared"
$sharedTags["Criticality"] = "High"
Apply-Tags -ResourceId $rgShared -Tags $sharedTags -ResourceName "rg-updatelens-shared"

# Individual resources (get IDs dynamically)
$resources = @(
    @{Name="updatelens-api"; RG="rg-updatelens-runtime"; Type="webapp"; Tags=@{"Application"="UpdateLens-WebApp"; "DataClassification"="Internal"}},
    @{Name="updatelens-functions-itn"; RG="rg-updatelens-runtime"; Type="functionapp"; Tags=@{"Application"="UpdateLens-Functions"; "MaintenanceWindow"="Sunday-02:00-04:00"}},
    @{Name="updatelensdataitn"; RG="rg-updatelens-shared"; Type="storage"; Tags=@{"Application"="UpdateLens-Storage"; "DataClassification"="Internal"; "BackupPolicy"="Snapshot-Versioning"}},
    @{Name="updatelens-appinsights"; RG="rg-updatelens-shared"; Type="appinsights"; Tags=@{"Application"="UpdateLens-Monitoring"}},
    @{Name="updatelens-law"; RG="rg-updatelens-shared"; Type="law"; Tags=@{"Application"="UpdateLens-Logging"}},
    @{Name="oidc-updatelens-msi"; RG="rg-updatelens-shared"; Type="identity"; Tags=@{"Application"="UpdateLens-Identity"; "ManagedBy"="GitHub-OIDC"}}
)

foreach ($resource in $resources) {
    $resourceId = switch ($resource.Type) {
        "webapp" { az webapp show -g $resource.RG -n $resource.Name --query id -o tsv }
        "functionapp" { az functionapp show -g $resource.RG -n $resource.Name --query id -o tsv }
        "storage" { az storage account show -g $resource.RG -n $resource.Name --query id -o tsv }
        "appinsights" { az monitor app-insights component show -g $resource.RG -a $resource.Name --query id -o tsv }
        "law" { az monitor log-analytics workspace show -g $resource.RG -n $resource.Name --query id -o tsv }
        "identity" { az identity show -g $resource.RG -n $resource.Name --query id -o tsv }
    }
    
    if ($resourceId) {
        Apply-Tags -ResourceId $resourceId -Tags $resource.Tags -ResourceName $resource.Name
    } else {
        Write-Host "⚠️  Resource not found: $($resource.Name)" -ForegroundColor Yellow
    }
}

Write-Host "`n🎉 Tagging completato!" -ForegroundColor Cyan
```

**Uso**:
```powershell
# Dry-run (preview)
.\azure-tags-apply.ps1 -SubscriptionId "your-sub-id" -WhatIf

# Applicazione effettiva
.\azure-tags-apply.ps1 -SubscriptionId "your-sub-id"
```

---

### Azure Policy per Enforcement

Creare una policy per richiedere tags obbligatori su nuove risorse:

```json
{
  "properties": {
    "displayName": "UpdateLens - Require Standard Tags",
    "policyType": "Custom",
    "mode": "Indexed",
    "description": "Richiede tags standard su tutte le risorse UpdateLens",
    "metadata": {
      "category": "Tags",
      "version": "1.0.0"
    },
    "parameters": {
      "tagNames": {
        "type": "Array",
        "metadata": {
          "displayName": "Tag Names",
          "description": "List of required tag names"
        },
        "defaultValue": [
          "Environment",
          "Project",
          "Owner",
          "CostCenter",
          "ManagedBy"
        ]
      }
    },
    "policyRule": {
      "if": {
        "anyOf": [
          {
            "field": "[concat('tags[', parameters('tagNames')[0], ']')]",
            "exists": "false"
          },
          {
            "field": "[concat('tags[', parameters('tagNames')[1], ']')]",
            "exists": "false"
          },
          {
            "field": "[concat('tags[', parameters('tagNames')[2], ']')]",
            "exists": "false"
          },
          {
            "field": "[concat('tags[', parameters('tagNames')[3], ']')]",
            "exists": "false"
          },
          {
            "field": "[concat('tags[', parameters('tagNames')[4], ']')]",
            "exists": "false"
          }
        ]
      },
      "then": {
        "effect": "deny"
      }
    }
  }
}
```

**Applicazione Policy**:
```bash
# Creare policy definition
az policy definition create \
  --name "updatelens-require-tags" \
  --display-name "UpdateLens - Require Standard Tags" \
  --description "Richiede tags standard su risorse UpdateLens" \
  --rules policy-rules.json \
  --mode Indexed

# Assegnare policy a Resource Group
az policy assignment create \
  --name "updatelens-tags-runtime" \
  --display-name "UpdateLens Tags - Runtime RG" \
  --policy "updatelens-require-tags" \
  --scope "/subscriptions/<SUB_ID>/resourceGroups/rg-updatelens-runtime"

az policy assignment create \
  --name "updatelens-tags-shared" \
  --display-name "UpdateLens Tags - Shared RG" \
  --policy "updatelens-require-tags" \
  --scope "/subscriptions/<SUB_ID>/resourceGroups/rg-updatelens-shared"
```

---

## Validazione

### Query Azure Resource Graph

```kusto
// Verifica tags su tutte le risorse UpdateLens
Resources
| where resourceGroup startswith "rg-updatelens"
| project name, type, resourceGroup, tags
| extend 
    hasEnvironment = isnotnull(tags.Environment),
    hasProject = isnotnull(tags.Project),
    hasOwner = isnotnull(tags.Owner),
    hasCostCenter = isnotnull(tags.CostCenter),
    hasManagedBy = isnotnull(tags.ManagedBy)
| where not(hasEnvironment and hasProject and hasOwner and hasCostCenter and hasManagedBy)
| project name, type, resourceGroup, 
    missingTags = pack_array(
        iff(hasEnvironment, "", "Environment"),
        iff(hasProject, "", "Project"),
        iff(hasOwner, "", "Owner"),
        iff(hasCostCenter, "", "CostCenter"),
        iff(hasManagedBy, "", "ManagedBy")
    )
```

### Script Verifica PowerShell

```powershell
# verify-tags.ps1
$requiredTags = @("Environment", "Project", "Owner", "CostCenter", "ManagedBy")

$resources = az resource list --query "[?resourceGroup=='rg-updatelens-runtime' || resourceGroup=='rg-updatelens-shared']" | ConvertFrom-Json

$missingTags = @()

foreach ($resource in $resources) {
    $tags = $resource.tags
    $missing = @()
    
    foreach ($tag in $requiredTags) {
        if (-not $tags.$tag) {
            $missing += $tag
        }
    }
    
    if ($missing.Count -gt 0) {
        $missingTags += [PSCustomObject]@{
            Resource = $resource.name
            Type = $resource.type
            MissingTags = $missing -join ", "
        }
    }
}

if ($missingTags.Count -eq 0) {
    Write-Host "✅ Tutti i tags obbligatori sono presenti!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Risorse con tags mancanti:" -ForegroundColor Yellow
    $missingTags | Format-Table -AutoSize
}
```

---

## Benefici

### Cost Management
- **Chargeback accurato** - Costi allocati per CostCenter
- **Trend analysis** - Costi per Environment/Project
- **Budget alerts** - Alert per tag specifici

### Governance
- **Compliance** - Policy enforcement automatico
- **Auditing** - Tracciabilità owner e deployment
- **Lifecycle** - Identificazione risorse obsolete

### Operations
- **Automation** - Script basati su tags
- **Monitoring** - Alert grouping per Application
- **Disaster Recovery** - Backup policy per tag

---

## Rollback

Se necessario rimuovere tags:

```powershell
# Rimuovi tutti i tags da una risorsa
az tag delete --resource-id <RESOURCE_ID>

# Rimuovi tag specifico
az tag update --resource-id <RESOURCE_ID> --operation Delete --tags Environment
```

---

## Timeline

| Fase | Durata | Descrizione |
|------|--------|-------------|
| 1. Preparazione | 1h | Definire tag schema, valori, script |
| 2. Testing | 1h | Test su risorsa singola, validazione |
| 3. Applicazione | 1h | Applicare tags a tutte le risorse |
| 4. Policy Setup | 1h | Creare e assegnare Azure Policy |
| 5. Validazione | 0.5h | Verificare applicazione corretta |
| 6. Documentazione | 0.5h | Aggiornare runbook e wiki |
| **Totale** | **5h** | |

---

## Checklist Implementazione

- [ ] Definire tag schema e valori
- [ ] Ottenere Subscription ID
- [ ] Creare script PowerShell
- [ ] Test su risorsa singola (WhatIf mode)
- [ ] Applicare tags a Resource Groups
- [ ] Applicare tags a risorse individuali
- [ ] Verificare con Azure Resource Graph query
- [ ] Creare Azure Policy definition
- [ ] Assegnare policy a Resource Groups
- [ ] Documentare in runbook
- [ ] Aggiornare GitHub Actions per tag automatici
- [ ] Schedulare review trimestrale tags

---

**Status**: 📋 Ready for Implementation  
**Owner**: Alessandro Levantini  
**Approval Required**: Yes (CostCenter values)
