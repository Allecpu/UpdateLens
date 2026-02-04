const parseConnectionString = (value) => {
    return value
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .reduce((acc, part) => {
        const idx = part.indexOf('=');
        if (idx <= 0) {
            return acc;
        }
        const key = part.slice(0, idx).trim();
        const val = part.slice(idx + 1).trim();
        if (key) {
            acc[key] = val;
        }
        return acc;
    }, {});
};
export const getAzureOpenAIConfig = () => {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? '2024-10-21';
    if (!endpoint || !apiKey || !deployment) {
        return null;
    }
    return { endpoint, apiKey, deployment, apiVersion };
};
export const getAppInsightsConfig = () => {
    const connString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    if (!connString) {
        return null;
    }
    const parsed = parseConnectionString(connString);
    const instrumentationKey = parsed.InstrumentationKey;
    if (!instrumentationKey) {
        return null;
    }
    const ingestionEndpoint = (parsed.IngestionEndpoint ?? 'https://dc.services.visualstudio.com').replace(/\/$/, '');
    return { instrumentationKey, ingestionEndpoint };
};
export const getAzureServicesStatus = () => {
    const openAI = getAzureOpenAIConfig();
    const appInsights = getAppInsightsConfig();
    return {
        chatEngine: (process.env.CHAT_ENGINE ?? 'local').toLowerCase(),
        azureOpenAIConfigured: Boolean(openAI),
        appInsightsConfigured: Boolean(appInsights),
        azureOpenAIDeployment: openAI?.deployment ?? null,
        azureOpenAIApiVersion: openAI?.apiVersion ?? null
    };
};
