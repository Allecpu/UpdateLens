# Azure Resource Tags - UpdateLens
# Author: Alessandro Levantini
# Date: 2026-02-02
# Description: Applica tags standardizzati a tutte le risorse UpdateLens

<#
.SYNOPSIS
    Applica tags Azure standardizzati a risorse UpdateLens

.DESCRIPTION
    Script per applicare tags comuni a Resource Groups e risorse individuali.
    Supporta modalità WhatIf per preview e merge mode per preservare tags esistenti.

.PARAMETER SubscriptionId
    Azure Subscription ID (obbligatorio)

.PARAMETER WhatIf
    Modalità preview - mostra cosa verrebbe modificato senza applicare

.PARAMETER Environment
    Environment tag value (default: Production)

.PARAMETER Owner
    Owner email (default: alessandro.levantini@css.it)

.PARAMETER CostCenter
    Cost Center code (default: IT-INFRA-001)

.EXAMPLE
    .\azure-tags-apply.ps1 -SubscriptionId "your-sub-id" -WhatIf
    Preview delle modifiche

.EXAMPLE
    .\azure-tags-apply.ps1 -SubscriptionId "your-sub-id"
    Applica tags effettivamente

.EXAMPLE
    .\azure-tags-apply.ps1 -SubscriptionId "your-sub-id" -Environment "Staging" -Owner "team@css.it"
    Applica tags con valori custom
#>

param(
    [Parameter(Mandatory = $true, HelpMessage = "Azure Subscription ID")]
    [string]$SubscriptionId,
    
    [Parameter(Mandatory = $false)]
    [switch]$WhatIf,
    
    [Parameter(Mandatory = $false)]
    [ValidateSet("Production", "Staging", "Development", "Test")]
    [string]$Environment = "Production",
    
    [Parameter(Mandatory = $false)]
    [string]$Owner = "alessandro.levantini@css.it",
    
    [Parameter(Mandatory = $false)]
    [string]$CostCenter = "IT-INFRA-001",
    
    [Parameter(Mandatory = $false)]
    [string]$Version = "0.4.0"
)

# Colori per output
$ColorSuccess = "Green"
$ColorWarning = "Yellow"
$ColorError = "Red"
$ColorInfo = "Cyan"

# Funzione per applicare tags
function Apply-Tags {
    param(
        [string]$ResourceId,
        [hashtable]$Tags,
        [string]$ResourceName
    )
    
    if ($WhatIf) {
        Write-Host "WHATIF: Would tag $ResourceName" -ForegroundColor $ColorWarning
        $Tags.GetEnumerator() | ForEach-Object {
            Write-Host "  $($_.Key) = $($_.Value)" -ForegroundColor Gray
        }
        return $true
    }
    else {
        try {
            # Converti hashtable in formato JSON per az tag
            $tagsJson = $Tags | ConvertTo-Json -Compress
            
            # Applica tags con merge mode
            $result = az tag update `
                --resource-id $ResourceId `
                --tags ($Tags.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) `
                --operation Merge `
                --output none 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Tagged: $ResourceName" -ForegroundColor $ColorSuccess
                return $true
            }
            else {
                Write-Host "❌ Failed to tag: $ResourceName" -ForegroundColor $ColorError
                Write-Host "   Error: $result" -ForegroundColor $ColorError
                return $false
            }
        }
        catch {
            Write-Host "❌ Exception tagging: $ResourceName" -ForegroundColor $ColorError
            Write-Host "   Error: $_" -ForegroundColor $ColorError
            return $false
        }
    }
}

# Funzione per ottenere Resource ID
function Get-ResourceId {
    param(
        [string]$ResourceGroup,
        [string]$ResourceName,
        [string]$ResourceType
    )
    
    try {
        $resourceId = switch ($ResourceType) {
            "webapp" { 
                az webapp show -g $ResourceGroup -n $ResourceName --query id -o tsv 2>$null
            }
            "functionapp" { 
                az functionapp show -g $ResourceGroup -n $ResourceName --query id -o tsv 2>$null
            }
            "storage" { 
                az storage account show -g $ResourceGroup -n $ResourceName --query id -o tsv 2>$null
            }
            "appinsights" { 
                az monitor app-insights component show -g $ResourceGroup -a $ResourceName --query id -o tsv 2>$null
            }
            "law" { 
                az monitor log-analytics workspace show -g $ResourceGroup -n $ResourceName --query id -o tsv 2>$null
            }
            "identity" { 
                az identity show -g $ResourceGroup -n $ResourceName --query id -o tsv 2>$null
            }
            "appserviceplan" {
                az appservice plan show -g $ResourceGroup -n $ResourceName --query id -o tsv 2>$null
            }
        }
        
        if ([string]::IsNullOrWhiteSpace($resourceId)) {
            return $null
        }
        
        return $resourceId.Trim()
    }
    catch {
        return $null
    }
}

# Banner
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor $ColorInfo
Write-Host "  Azure Resource Tags - UpdateLens" -ForegroundColor $ColorInfo
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor $ColorInfo
Write-Host ""

if ($WhatIf) {
    Write-Host "⚠️  WHATIF MODE - No changes will be applied" -ForegroundColor $ColorWarning
    Write-Host ""
}

Write-Host "Subscription: $SubscriptionId" -ForegroundColor $ColorInfo
Write-Host "Environment: $Environment" -ForegroundColor $ColorInfo
Write-Host "Owner: $Owner" -ForegroundColor $ColorInfo
Write-Host "Cost Center: $CostCenter" -ForegroundColor $ColorInfo
Write-Host "Version: $Version" -ForegroundColor $ColorInfo
Write-Host ""

# Verifica Azure CLI
Write-Host "Verifying Azure CLI..." -ForegroundColor $ColorInfo
$azVersion = az version --query '\"azure-cli\"' -o tsv 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Azure CLI not found. Please install: https://aka.ms/InstallAzureCLI" -ForegroundColor $ColorError
    exit 1
}
Write-Host "✅ Azure CLI version: $azVersion" -ForegroundColor $ColorSuccess
Write-Host ""

# Login check
Write-Host "Checking Azure login..." -ForegroundColor $ColorInfo
$account = az account show --query name -o tsv 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Not logged in to Azure. Running 'az login'..." -ForegroundColor $ColorWarning
    az login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Login failed" -ForegroundColor $ColorError
        exit 1
    }
}
Write-Host "✅ Logged in as: $account" -ForegroundColor $ColorSuccess
Write-Host ""

# Set subscription
Write-Host "Setting subscription..." -ForegroundColor $ColorInfo
az account set --subscription $SubscriptionId 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to set subscription: $SubscriptionId" -ForegroundColor $ColorError
    exit 1
}
Write-Host "✅ Subscription set" -ForegroundColor $ColorSuccess
Write-Host ""

# Common tags
$commonTags = @{
    "Environment" = $Environment
    "Project"     = "UpdateLens"
    "Owner"       = $Owner
    "CostCenter"  = $CostCenter
    "ManagedBy"   = "GitHub-Actions"
    "DeployedBy"  = "CI/CD"
    "Version"     = $Version
}

# Statistiche
$stats = @{
    Total    = 0
    Success  = 0
    Failed   = 0
    NotFound = 0
}

Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor $ColorInfo
Write-Host "  RESOURCE GROUPS" -ForegroundColor $ColorInfo
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor $ColorInfo
Write-Host ""

# Tag Resource Groups
$resourceGroups = @(
    @{
        Name           = "rg-updatelens-runtime"
        AdditionalTags = @{
            "Application" = "UpdateLens-Runtime"
            "Criticality" = "High"
        }
    },
    @{
        Name           = "rg-updatelens-shared"
        AdditionalTags = @{
            "Application" = "UpdateLens-Shared"
            "Criticality" = "High"
        }
    }
)

foreach ($rg in $resourceGroups) {
    $stats.Total++
    
    $rgId = "/subscriptions/$SubscriptionId/resourceGroups/$($rg.Name)"
    $rgTags = $commonTags.Clone()
    
    # Merge additional tags
    foreach ($key in $rg.AdditionalTags.Keys) {
        $rgTags[$key] = $rg.AdditionalTags[$key]
    }
    
    $success = Apply-Tags -ResourceId $rgId -Tags $rgTags -ResourceName $rg.Name
    
    if ($success) {
        $stats.Success++
    }
    else {
        $stats.Failed++
    }
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor $ColorInfo
Write-Host "  INDIVIDUAL RESOURCES" -ForegroundColor $ColorInfo
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor $ColorInfo
Write-Host ""

# Individual resources
$resources = @(
    @{Name = "updatelens-api"; RG = "rg-updatelens-runtime"; Type = "webapp"; Tags = @{"Application" = "UpdateLens-WebApp"; "DataClassification" = "Internal" } },
    @{Name = "updatelens-functions-itn"; RG = "rg-updatelens-runtime"; Type = "functionapp"; Tags = @{"Application" = "UpdateLens-Functions"; "MaintenanceWindow" = "Sunday-02:00-04:00" } },
    @{Name = "plan-updatelens-api"; RG = "rg-updatelens-runtime"; Type = "appserviceplan"; Tags = @{"Application" = "UpdateLens-Plan-Web" } },
    @{Name = "plan-updatelens-functions"; RG = "rg-updatelens-runtime"; Type = "appserviceplan"; Tags = @{"Application" = "UpdateLens-Plan-Functions" } },
    @{Name = "updatelensdataitn"; RG = "rg-updatelens-shared"; Type = "storage"; Tags = @{"Application" = "UpdateLens-Storage"; "DataClassification" = "Internal"; "BackupPolicy" = "Snapshot-Versioning" } },
    @{Name = "updatelens-appinsights"; RG = "rg-updatelens-shared"; Type = "appinsights"; Tags = @{"Application" = "UpdateLens-Monitoring" } },
    @{Name = "updatelens-law"; RG = "rg-updatelens-shared"; Type = "law"; Tags = @{"Application" = "UpdateLens-Logging" } },
    @{Name = "oidc-updatelens-msi"; RG = "rg-updatelens-shared"; Type = "identity"; Tags = @{"Application" = "UpdateLens-Identity"; "ManagedBy" = "GitHub-OIDC" } }
)

foreach ($resource in $resources) {
    $stats.Total++
    
    Write-Host "Processing: $($resource.Name) ($($resource.Type))..." -ForegroundColor Gray
    
    $resourceId = Get-ResourceId -ResourceGroup $resource.RG -ResourceName $resource.Name -ResourceType $resource.Type
    
    if ($null -eq $resourceId) {
        Write-Host "⚠️  Resource not found: $($resource.Name)" -ForegroundColor $ColorWarning
        $stats.NotFound++
        Write-Host ""
        continue
    }
    
    $resTags = $commonTags.Clone()
    if ($resource.Tags) {
        foreach ($key in $resource.Tags.Keys) {
            $resTags[$key] = $resource.Tags[$key]
        }
    }
    
    $success = Apply-Tags -ResourceId $resourceId -Tags $resTags -ResourceName $resource.Name
    
    if ($success) {
        $stats.Success++
    }
    else {
        $stats.Failed++
    }
    
    Write-Host ""
}

# Summary
Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor $ColorInfo
Write-Host "  SUMMARY" -ForegroundColor $ColorInfo
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor $ColorInfo
Write-Host ""
Write-Host "Total resources: $($stats.Total)" -ForegroundColor $ColorInfo
Write-Host "✅ Success: $($stats.Success)" -ForegroundColor $ColorSuccess
Write-Host "❌ Failed: $($stats.Failed)" -ForegroundColor $ColorError
Write-Host "⚠️  Not Found: $($stats.NotFound)" -ForegroundColor $ColorWarning
Write-Host ""

if ($WhatIf) {
    Write-Host "⚠️  This was a WHATIF run - no changes were applied" -ForegroundColor $ColorWarning
    Write-Host "   Run without -WhatIf to apply tags" -ForegroundColor $ColorWarning
}
elseif ($stats.Failed -eq 0 -and $stats.NotFound -eq 0) {
    Write-Host "🎉 All tags applied successfully!" -ForegroundColor $ColorSuccess
}
elseif ($stats.Failed -gt 0) {
    Write-Host "⚠️  Some tags failed to apply. Check errors above." -ForegroundColor $ColorWarning
    exit 1
}
else {
    Write-Host "✅ Tags applied with warnings (some resources not found)" -ForegroundColor $ColorSuccess
}

Write-Host ""
