import type { ChatQueryRequest, ChatQueryResponse } from './ChatSchemas.js';
import { getAzureOpenAIConfig } from './AzureServices.js';

type AzureEngineInput = {
  request: ChatQueryRequest;
  localResponse: ChatQueryResponse;
};

type AzureEngineOutput = {
  message: string;
  confidence: number;
  model: string;
};

type AzureQueryRefinerOutput = {
  refinedQuery: string | null;
  confidence: number;
  model: string;
};

const buildCompletionsUrl = (config: ReturnType<typeof getAzureOpenAIConfig>) => {
  if (!config) {
    throw new Error('Azure OpenAI non configurato');
  }
  const base = config.endpoint.replace(/\/$/, '');
  return (
    `${base}/openai/deployments/${encodeURIComponent(config.deployment)}` +
    `/chat/completions?api-version=${encodeURIComponent(config.apiVersion)}`
  );
};

export const runAzureChatEngine = async (
  input: AzureEngineInput
): Promise<AzureEngineOutput> => {
  const config = getAzureOpenAIConfig();
  if (!config) {
    throw new Error('Azure OpenAI non configurato');
  }
  const url = buildCompletionsUrl(config);

  const promptPayload = {
    userMessage: input.request.message,
    localMessage: input.localResponse.message,
    filterPatch: input.localResponse.filterPatch,
    resultCount: input.localResponse.items.length
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.apiKey
    },
    body: JSON.stringify({
      temperature: 0.2,
      max_tokens: 220,
      messages: [
        {
          role: 'system',
          content:
            'Sei assistente UpdateLens. Restituisci solo JSON valido con chiavi: ' +
            'message (string), confidence (number 0..1). Mantieni italiano chiaro e conciso.'
        },
        {
          role: 'user',
          content:
            `Riscrivi in modo utile la risposta chat in base ai dati forniti:\n` +
            `${JSON.stringify(promptPayload)}`
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Azure OpenAI error ${response.status}: ${text.slice(0, 250)}`);
  }

  const raw = (await response.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = raw.choices?.[0]?.message?.content?.trim() ?? '';
  if (!content) {
    throw new Error('Azure OpenAI ha restituito contenuto vuoto');
  }

  let parsed: { message?: unknown; confidence?: unknown } | null = null;
  try {
    parsed = JSON.parse(content) as { message?: unknown; confidence?: unknown };
  } catch {
    const firstLine = content.split('\n').find((line) => line.trim().length > 0) ?? '';
    return {
      message: firstLine || input.localResponse.message,
      confidence: 0.65,
      model: raw.model ?? config.deployment
    };
  }

  const message =
    typeof parsed.message === 'string' && parsed.message.trim().length > 0
      ? parsed.message.trim()
      : input.localResponse.message;
  const confidence =
    typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.65;

  return {
    message,
    confidence,
    model: raw.model ?? config.deployment
  };
};

export const runAzureQueryRefiner = async (
  userMessage: string
): Promise<AzureQueryRefinerOutput> => {
  const config = getAzureOpenAIConfig();
  if (!config) {
    throw new Error('Azure OpenAI non configurato');
  }
  const url = buildCompletionsUrl(config);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.apiKey
    },
    body: JSON.stringify({
      temperature: 0,
      max_tokens: 120,
      messages: [
        {
          role: 'system',
          content:
            'Converti la richiesta utente in una query di ricerca breve per dataset release notes. ' +
            'Rispondi solo JSON: {"refinedQuery": string|null, "confidence": number}. ' +
            'Metti null se non puoi migliorare.'
        },
        {
          role: 'user',
          content: userMessage
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Azure OpenAI error ${response.status}: ${text.slice(0, 250)}`);
  }

  const raw = (await response.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = raw.choices?.[0]?.message?.content?.trim() ?? '';
  if (!content) {
    return {
      refinedQuery: null,
      confidence: 0,
      model: raw.model ?? config.deployment
    };
  }

  try {
    const parsed = JSON.parse(content) as { refinedQuery?: unknown; confidence?: unknown };
    const refinedQuery =
      typeof parsed.refinedQuery === 'string' && parsed.refinedQuery.trim().length > 0
        ? parsed.refinedQuery.trim()
        : null;
    const confidence =
      typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.5;
    return {
      refinedQuery,
      confidence,
      model: raw.model ?? config.deployment
    };
  } catch {
    return {
      refinedQuery: null,
      confidence: 0,
      model: raw.model ?? config.deployment
    };
  }
};
