# Deployment Azure

UpdateLens viene distribuito esclusivamente tramite GitHub Actions. Non eseguire
push manuali di immagini o pacchetti verso Azure.

## Risorse

| Componente | Risorsa Azure |
|---|---|
| Portale e API Express | App Service `updatelens-api` |
| Refresh schedulato | Function App `updatelens-functions-itn` |
| Snapshot | Storage Account `updatelensdataitn` |
| Resource group runtime | `rg-updatelens-runtime` |

L'applicazione pubblica è protetta da Entra ID tramite App Service EasyAuth.
Una richiesta anonima alla root restituisce quindi `401 Unauthorized`.

## Deploy del portale

Il workflow [deploy-api.yml](../.github/workflows/deploy-api.yml) parte:

- automaticamente a ogni push sul branch `Azure`;
- manualmente tramite `workflow_dispatch`.

La pipeline esegue:

1. `npm ci`;
2. build frontend con Vite;
3. build TypeScript del server;
4. creazione e caricamento del pacchetto;
5. login Azure tramite OpenID Connect;
6. deploy su `updatelens-api`;
7. applicazione delle App Settings runtime.

Prima del push eseguire almeno:

```bash
npm run typecheck
npm run build
npm run build:server
```

Per modifiche all'export PowerPoint eseguire anche:

```bash
npm run test:deck
```

## Deploy delle Azure Functions

Il workflow
[deploy-functions.yml](../.github/workflows/deploy-functions.yml) parte su
modifiche a `functions/**` pubblicate in `main`, oppure manualmente. Non va
eseguito quando cambiano soltanto frontend, server Express o documentazione.

## Verifica post-deploy

1. Controllare che i job `build` e `deploy` siano verdi in GitHub Actions.
2. Verificare che App Service sia `Running` con availability `Normal`.
3. Accedere con Entra ID e controllare la pagina **Versione**.
4. Confermare versione, build e commit distribuiti.
5. Provare le funzioni modificate e controllare Application Insights in caso di errore.

Esempio di controllo runtime:

```bash
az webapp show \
  --resource-group rg-updatelens-runtime \
  --name updatelens-api \
  --query "{state:state,availabilityState:availabilityState,lastModified:lastModifiedTimeUtc}"
```

## Segreti CI/CD

Il workflow richiede `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` e
`AZURE_SUBSCRIPTION_ID`. Le impostazioni di Azure OpenAI e Application Insights
sono configurate come GitHub Secrets o Variables. Non inserirle nei file del
repository.
