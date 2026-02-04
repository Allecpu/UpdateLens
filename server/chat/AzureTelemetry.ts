import { getAppInsightsConfig } from './AzureServices.js';

type TelemetryEvent = {
  name: string;
  properties?: Record<string, string>;
  measurements?: Record<string, number>;
};

const SAFE_PROPERTY_KEYS = new Set([
  'engine',
  'fallbackUsed',
  'fallbackReason',
  'model',
  'errorCode',
  'status'
]);

const SAFE_MEASUREMENT_KEYS = new Set([
  'latencyMs',
  'confidence',
  'promptTokens',
  'completionTokens',
  'totalTokens',
  'resultCount',
  'httpStatus'
]);

const sanitizeProperties = (input?: Record<string, string>): Record<string, string> => {
  if (!input) {
    return {};
  }
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!SAFE_PROPERTY_KEYS.has(key)) {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    sanitized[key] = trimmed.slice(0, 120);
  }
  return sanitized;
};

const sanitizeMeasurements = (input?: Record<string, number>): Record<string, number> => {
  if (!input) {
    return {};
  }
  const sanitized: Record<string, number> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!SAFE_MEASUREMENT_KEYS.has(key) || !Number.isFinite(value)) {
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
};

export const trackServerChatEvent = async (event: TelemetryEvent) => {
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
        // Do not send raw prompts/completions or full payloads to telemetry.
        properties: sanitizeProperties(event.properties),
        measurements: sanitizeMeasurements(event.measurements)
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
  } catch {
    // Non bloccare la chat per errori telemetry.
  }
};
