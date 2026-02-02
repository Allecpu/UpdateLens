# Azure Infrastructure Setup

## Easy Auth Configuration for UpdateLens

Azure Easy Auth provides authentication without code changes. Users are automatically redirected to Microsoft login.

### One-Time Setup

Run the setup script to create the app registration and configure Easy Auth:

```bash
# Login to Azure
az login

# Run setup script
chmod +x infra/setup-easy-auth.sh
./infra/setup-easy-auth.sh
```

The script will:
1. Create an Azure Entra ID app registration for "UpdateLens"
2. Configure the App Service with Easy Auth
3. Output the Client ID and Secret to save as GitHub secrets

### GitHub Secrets Required

After running the setup script, add these secrets to GitHub repository:

| Secret | Description |
|--------|-------------|
| `AZURE_AUTH_CLIENT_ID` | The App Registration Client ID |
| `AZURE_AUTH_CLIENT_SECRET` | The generated client secret |

Note: `AZURE_TENANT_ID` should already be configured for OIDC auth.

### Manual Configuration via Azure Portal

If you prefer to configure manually:

1. **Create App Registration**:
   - Go to Azure Portal → Microsoft Entra ID → App registrations
   - Click "New registration"
   - Name: `UpdateLens`
   - Supported account types: "Accounts in this organizational directory only"
   - Redirect URI: `https://updatelens-api.azurewebsites.net/.auth/login/aad/callback`
   - Click "Register"

2. **Create Client Secret**:
   - In the app registration, go to "Certificates & secrets"
   - Click "New client secret"
   - Save the secret value immediately (it won't be shown again)

3. **Configure App Service Authentication**:
   - Go to Azure Portal → App Services → updatelens-api
   - Click "Authentication" in the left menu
   - Click "Add identity provider"
   - Select "Microsoft"
   - Choose "Provide the details of an existing app registration"
   - Enter Client ID and Client Secret
   - Issuer URL: `https://login.microsoftonline.com/{tenant-id}/v2.0`
   - Restrict access: "Require authentication"
   - Unauthenticated requests: "HTTP 302 Found redirect"
   - Click "Add"

### How Easy Auth Works

After configuration:

1. Users visiting the app are redirected to Microsoft login
2. After login, Azure injects user info via HTTP headers:
   - `X-MS-CLIENT-PRINCIPAL`: Base64-encoded JSON with user claims
   - `X-MS-CLIENT-PRINCIPAL-ID`: User's Object ID
   - `X-MS-CLIENT-PRINCIPAL-NAME`: User's email/UPN

3. The backend extracts these headers to identify the user (see `server/auth.ts`)

### Domain Restriction

The app only allows sharing with `@eos-solutions.it` email addresses. This is enforced in:
- `server/auth.ts`: `isAllowedDomain()` function
- `src/app/components/filters/SharePresetModal.tsx`: Frontend validation

### Troubleshooting

**"Autenticazione non configurata" error**:
- Easy Auth is only active when `DB_PATH=/home/data` (Azure environment)
- Check that authentication is enabled in App Service settings

**Users not being authenticated**:
- Verify the redirect URI matches: `https://updatelens-api.azurewebsites.net/.auth/login/aad/callback`
- Check that the client secret hasn't expired
- Ensure the app registration is in the correct tenant

**Claims not received**:
- Verify the App Service logs for authentication errors
- Check that ID token issuance is enabled in app registration

### Local Development

Easy Auth is not available locally. The app will:
- Return 503 for `/api/auth/me`
- Fall back to localStorage for presets
- Hide sharing features in the UI

To test authentication locally, you can mock the `X-MS-CLIENT-PRINCIPAL` header.
