# Azure Resource Tags - Scripts

Questa cartella contiene script PowerShell per gestire i tags Azure delle risorse UpdateLens.

## Script Disponibili

### 1. azure-tags-apply.ps1

Applica tags standardizzati a tutte le risorse UpdateLens.

**Uso**:
```powershell
# Preview (WhatIf mode)
.\azure-tags-apply.ps1 -SubscriptionId "your-subscription-id" -WhatIf

# Applicazione effettiva
.\azure-tags-apply.ps1 -SubscriptionId "your-subscription-id"

# Con parametri custom
.\azure-tags-apply.ps1 `
    -SubscriptionId "your-subscription-id" `
    -Environment "Production" `
    -Owner "alessandro.levantini@css.it" `
    -CostCenter "IT-INFRA-001" `
    -Version "0.4.0"
```

**Parametri**:
- `-SubscriptionId` (obbligatorio): Azure Subscription ID
- `-WhatIf` (opzionale): Modalità preview senza applicare modifiche
- `-Environment` (opzionale): Environment tag (default: "Production")
- `-Owner` (opzionale): Owner email (default: "alessandro.levantini@css.it")
- `-CostCenter` (opzionale): Cost Center code (default: "IT-INFRA-001")
- `-Version` (opzionale): Version tag (default: "0.4.0")

**Tags Applicati**:

**Common Tags** (tutti i resource):
- `Environment`: Production/Staging/Development/Test
- `Project`: UpdateLens
- `Owner`: Email responsabile
- `CostCenter`: Codice centro di costo
- `ManagedBy`: GitHub-Actions
- `DeployedBy`: CI/CD
- `Version`: Versione applicazione

**Resource-Specific Tags**:
- **Web App**: `Application=UpdateLens-WebApp`, `DataClassification=Internal`
- **Functions**: `Application=UpdateLens-Functions`, `MaintenanceWindow=Sunday-02:00-04:00`
- **Storage**: `Application=UpdateLens-Storage`, `DataClassification=Internal`, `BackupPolicy=Snapshot-Versioning`
- **App Insights**: `Application=UpdateLens-Monitoring`
- **Log Analytics**: `Application=UpdateLens-Logging`
- **Managed Identity**: `Application=UpdateLens-Identity`, `ManagedBy=GitHub-OIDC`

---

### 2. azure-tags-verify.ps1

Verifica che tutti i tags obbligatori siano presenti.

**Uso**:
```powershell
# Verifica base
.\azure-tags-verify.ps1 -SubscriptionId "your-subscription-id"

# Verifica con export CSV
.\azure-tags-verify.ps1 `
    -SubscriptionId "your-subscription-id" `
    -ExportCsv "tags-report.csv"
```

**Parametri**:
- `-SubscriptionId` (obbligatorio): Azure Subscription ID
- `-ExportCsv` (opzionale): Path per esportare report in CSV

**Tags Verificati** (obbligatori):
- `Environment`
- `Project`
- `Owner`
- `CostCenter`
- `ManagedBy`

**Output**:
- Lista risorse con tags mancanti
- Summary con conteggio compliant/non-compliant
- Exit code 0 se tutto OK, 1 se ci sono problemi

---

## Prerequisiti

### Azure CLI
Installare Azure CLI: https://aka.ms/InstallAzureCLI

Verificare installazione:
```powershell
az version
```

### Login Azure
```powershell
az login
```

### Subscription ID
Ottenere Subscription ID:
```powershell
az account list --query "[].{Name:name, SubscriptionId:id}" -o table
```

---

## Workflow Consigliato

### 1. Preview Tags
```powershell
.\azure-tags-apply.ps1 -SubscriptionId "your-sub-id" -WhatIf
```

### 2. Applicazione Tags
```powershell
.\azure-tags-apply.ps1 -SubscriptionId "your-sub-id"
```

### 3. Verifica
```powershell
.\azure-tags-verify.ps1 -SubscriptionId "your-sub-id"
```

### 4. Export Report (opzionale)
```powershell
.\azure-tags-verify.ps1 -SubscriptionId "your-sub-id" -ExportCsv "tags-report-$(Get-Date -Format 'yyyy-MM-dd').csv"
```

---

## Troubleshooting

### Errore: "Azure CLI not found"
**Soluzione**: Installare Azure CLI da https://aka.ms/InstallAzureCLI

### Errore: "Not logged in to Azure"
**Soluzione**: Eseguire `az login`

### Errore: "Failed to set subscription"
**Soluzione**: Verificare Subscription ID con `az account list`

### Errore: "Resource not found"
**Soluzione**: Verificare che la risorsa esista nel Resource Group specificato

### Warning: "Some resources not found"
**Soluzione**: Normale se alcune risorse non sono ancora create (es. Key Vault, Cosmos DB)

---

## Azure Policy (Opzionale)

Per enforcement automatico dei tags, creare Azure Policy:

```powershell
# Creare policy definition
az policy definition create `
    --name "updatelens-require-tags" `
    --display-name "UpdateLens - Require Standard Tags" `
    --description "Richiede tags standard su risorse UpdateLens" `
    --rules policy-rules.json `
    --mode Indexed

# Assegnare policy
az policy assignment create `
    --name "updatelens-tags-runtime" `
    --policy "updatelens-require-tags" `
    --scope "/subscriptions/<SUB_ID>/resourceGroups/rg-updatelens-runtime"
```

Vedi `azure_tags_plan.md` per dettagli completi.

---

## Manutenzione

### Review Trimestrale
Schedulare review trimestrale dei tags:
```powershell
# Esportare report
.\azure-tags-verify.ps1 -SubscriptionId "your-sub-id" -ExportCsv "tags-review-Q1-2026.csv"

# Verificare:
# - Owner ancora validi?
# - CostCenter aggiornati?
# - Version corretta?
```

### Update Version Tag
Quando si rilascia nuova versione:
```powershell
.\azure-tags-apply.ps1 -SubscriptionId "your-sub-id" -Version "0.5.0"
```

---

## Sicurezza

⚠️ **IMPORTANTE**: Questi script usano `az tag create` con `--operation Merge`, che:
- ✅ Preserva tags esistenti
- ✅ Aggiunge nuovi tags
- ✅ Aggiorna tags esistenti con nuovi valori
- ❌ NON rimuove tags esistenti

Per rimuovere tags:
```powershell
az tag delete --resource-id <RESOURCE_ID>
```

---

## Supporto

Per problemi o domande:
- **Owner**: Alessandro Levantini
- **Email**: alessandro.levantini@css.it
- **Project**: UpdateLens
- **Docs**: Vedi `azure_tags_plan.md` per piano completo

---

**Last Updated**: 2026-02-02  
**Version**: 1.0.0
