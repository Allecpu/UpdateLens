import { getAppInsightsConfig } from './AzureServices.js';
export const trackServerChatEvent = async (event) => {
    const config = getAppInsightsConfig();
    if (!config) {
        return;
    }
    const envelope = {
        name: 'Microsoft.ApplicationInsights.Event',
        time: new Date().toISOString(),
        iKey: config.instrumentationKey,
        tags: {
            'ai.cloud.role': process.env.WEBSITE_SITE_NAME ?? 'updatelens-chat-api'
        },
        data: {
            baseType: 'EventData',
            baseData: {
                name: event.name,
                properties: event.properties ?? {},
                measurements: event.measurements ?? {}
            }
        }
    };
    try {
        await fetch(`${config.ingestionEndpoint}/v2/track`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify([envelope])
        });
    }
    catch {
        // Non bloccare la chat per errori telemetry.
    }
};
