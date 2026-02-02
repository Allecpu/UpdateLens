# Azure Resource Tags - Validation Script
# Author: Alessandro Levantini
# Date: 2026-02-02
# Description: Verifica che tutti i tags obbligatori siano presenti

<#
.SYNOPSIS
    Verifica tags Azure su risorse UpdateLens

.DESCRIPTION
    Script per verificare che tutti i tags obbligatori siano presenti
    su Resource Groups e risorse individuali.

.PARAMETER SubscriptionId
    Azure Subscription ID (obbligatorio)

.PARAMETER ExportCsv
    Path per esportare risultati in CSV

.EXAMPLE
    .\azure-tags-verify.ps1 -SubscriptionId "your-sub-id"
    Verifica tags

.EXAMPLE
    .\azure-tags-verify.ps1 -SubscriptionId "your-sub-id" -ExportCsv "tags-report.csv"
    Verifica e esporta report
#>

param(
    [Parameter(Mandatory = $true, HelpMessage = "Azure Subscription ID")]
    [string]$SubscriptionId,
    
    [Parameter(Mandatory = $false)]
    [string]$ExportCsv
)

# Colori
$ColorSuccess = "Green"
$ColorWarning = "Yellow"
$ColorError = "Red"
$ColorInfo = "Cyan"

# Tags obbligatori
$requiredTags = @("Environment", "Project", "Owner", "CostCenter", "ManagedBy")

# Banner
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor $ColorInfo
Write-Host "  Azure Resource Tags - Validation" -ForegroundColor $ColorInfo
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor $ColorInfo
Write-Host ""

# Set subscription
Write-Host "Setting subscription: $SubscriptionId" -ForegroundColor $ColorInfo
az account set --subscription $SubscriptionId 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to set subscription" -ForegroundColor $ColorError
    exit 1
}
Write-Host "✅ Subscription set" -ForegroundColor $ColorSuccess
Write-Host ""

# Get all resources in UpdateLens resource groups
Write-Host "Fetching resources..." -ForegroundColor $ColorInfo
$resourcesJson = az resource list --query "[?resourceGroup=='rg-updatelens-runtime' || resourceGroup=='rg-updatelens-shared']" | ConvertFrom-Json

if ($null -eq $resourcesJson) {
    Write-Host "❌ No resources found" -ForegroundColor $ColorError
    exit 1
}

Write-Host "✅ Found $($resourcesJson.Count) resources" -ForegroundColor $ColorSuccess
Write-Host ""

# Analyze tags
$results = @()
$missingTagsCount = 0

foreach ($resource in $resourcesJson) {
    $tags = $resource.tags
    $missing = @()
    
    foreach ($tag in $requiredTags) {
        if (-not $tags.$tag) {
            $missing += $tag
        }
    }
    
    $result = [PSCustomObject]@{
        ResourceName  = $resource.name
        ResourceType  = $resource.type
        ResourceGroup = $resource.resourceGroup
        Location      = $resource.location
        HasAllTags    = ($missing.Count -eq 0)
        MissingTags   = ($missing -join ", ")
        Environment   = $tags.Environment
        Project       = $tags.Project
        Owner         = $tags.Owner
        CostCenter    = $tags.CostCenter
        ManagedBy     = $tags.ManagedBy
    }
    
    $results += $result
    
    if ($missing.Count -gt 0) {
        $missingTagsCount++
    }
}

# Display results
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor $ColorInfo
Write-Host "  VALIDATION RESULTS" -ForegroundColor $ColorInfo
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor $ColorInfo
Write-Host ""

if ($missingTagsCount -eq 0) {
    Write-Host "✅ All resources have required tags!" -ForegroundColor $ColorSuccess
    Write-Host ""
    
    # Show summary
    $results | Format-Table -Property ResourceName, ResourceType, Environment, Owner -AutoSize
}
else {
    Write-Host "⚠️  $missingTagsCount resources missing tags:" -ForegroundColor $ColorWarning
    Write-Host ""
    
    # Show only resources with missing tags
    $results | Where-Object { -not $_.HasAllTags } | Format-Table -Property ResourceName, ResourceType, MissingTags -AutoSize
    
    Write-Host ""
    Write-Host "Full details:" -ForegroundColor $ColorInfo
    $results | Where-Object { -not $_.HasAllTags } | Format-List
}

# Export CSV if requested
if ($ExportCsv) {
    $results | Export-Csv -Path $ExportCsv -NoTypeInformation -Encoding UTF8
    Write-Host ""
    Write-Host "✅ Report exported to: $ExportCsv" -ForegroundColor $ColorSuccess
}

# Summary
Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor $ColorInfo
Write-Host "  SUMMARY" -ForegroundColor $ColorInfo
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor $ColorInfo
Write-Host ""
Write-Host "Total resources: $($results.Count)" -ForegroundColor $ColorInfo
Write-Host "✅ Compliant: $($results.Count - $missingTagsCount)" -ForegroundColor $ColorSuccess
Write-Host "⚠️  Missing tags: $missingTagsCount" -ForegroundColor $ColorWarning
Write-Host ""

if ($missingTagsCount -gt 0) {
    Write-Host "❌ Validation FAILED - Some resources missing required tags" -ForegroundColor $ColorError
    exit 1
}
else {
    Write-Host "✅ Validation PASSED - All resources compliant" -ForegroundColor $ColorSuccess
    exit 0
}
