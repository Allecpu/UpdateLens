# Specifications for New Azure Project: EOS Power Content AI

This document outlines the specifications for creating the new "EOS Power Content AI" project in Azure, replicating the "UpdateLens" architecture.

## 1. General Project Information
*   **Project Name**: **EOS Power Content AI**.
*   **Target Location**: **Italy North** (`italynorth`).
*   **Subscription**: Same as current (`...ded83ba91749`).
*   **Repository**: **New Dedicated Repository**.
*   **Architecture Pattern**: Azure App Service (Web + Function) + Storage + Monitoring.

## 2. Infrastructure Resources & Naming Convention
A new resource prefix will be used (e.g., `epcai` or `eos-ai`) to distinguish from `updatelens`.

| Resource Type | Proposed Name (Example) | SKU | Purpose |
| :--- | :--- | :--- | :--- |
| **Resource Group (Runtime)** | `rg-eos-content-ai-runtime` | - | Compute resources. |
| **Resource Group (Shared)** | `rg-eos-content-ai-shared` | - | Storage, Identity, Logs. |
| **Storage Account** | `eoscontentaidata` | Standard_LRS | Data & Function content. |
| **Function App** | `func-eos-content-ai` | Linux / B1 | Backend logic. |
| **App Service Plan** | `plan-eos-content-ai` | Linux / B1 | Hosting Web & Func. |
| **Web App** | `web-eos-content-ai` | Node.js 20 | Frontend/API. |
| **App Insights** | `ai-eos-content-ai` | Web | Monitoring. |
| **Managed Identity** | `id-eos-content-ai-github` | User Assigned | GitHub OIDC. |

## 3. User Management & Authentication (Updated)
*   **Authentication**: Azure App Service Authentication (Easy Auth).
    *   **Crucial Requirement**: Must support **Cross-Tenant / Multi-Tenant** Entra ID login (to allow access from other EOS tenants).
    *   **App Registration**: Requires "Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant)" or specific tenant allow-listing.
*   **Authorization**: Application-level RBAC.
    *   **Database**: Start with an **Empty SQLite Database**.
    *   **Admin Setup**: First login or manual seed required to establish the first admin.
    *   **Logic Update**: `server/auth.ts` must be updated to handle/validate issuer tenants if necessary, or simply trust the Easy Auth configuration.

## 4. Resource Tagging Strategy
Standardized tagging using `scripts/azure-tags-apply.ps1` logic.

**Standard Tags:**
*   `Project`: EOS Power Content AI
*   `Environment`: Production
*   `Owner`: [TBD]
*   `CostCenter`: [TBD]
*   `ManagedBy`: GitHub-Actions

## 5. Deployment & CI/CD
*   **Repository**: Dedicated new repository.
*   **Pipeline**: GitHub Actions (to be set up in the new repo).
*   **Auth**: OIDC Federation with the new User Assigned Identity.

---

## 6. Implementation Plan
1.  [ ] **Repo Setup**: Initialize new repository.
2.  [ ] **Azure Setup**:
    *   Create Resource Groups (`rg-eos-content-ai-*`).
    *   Create App Registration (Multi-tenant) & Client Secret/Certificate.
    *   Deploy Infrastructure (Web, Func, Storage).
3.  [ ] **Configuration**:
    *   Configure Easy Auth on Web App for Multi-tenant.
    *   Set App Settings (Client ID, Issuer, etc.).
4.  [ ] **Codebase**:
    *   Push code to new repo.
    *   Update `auth.ts` to support multi-tenant validation (if specific tenant IDs need restriction).
5.  [ ] **Database**:
    *   Deploy with empty `data.db`.
