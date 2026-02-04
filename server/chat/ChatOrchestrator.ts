import { runAzureChatEngine, runAzureQueryRefiner } from './AzureChatEngine.js';
import { runLocalChatEngine } from './LocalChatEngine.js';
import { trackServerChatEvent } from './AzureTelemetry.js';
import type { ChatQueryRequest, ChatQueryResponse } from './ChatSchemas.js';

const shouldUseAzure = (request: ChatQueryRequest): boolean => {
  if (request.preferAzure) {
    return true;
  }
  return (process.env.CHAT_ENGINE ?? 'local').toLowerCase() === 'azure';
};

const getConfidenceThreshold = (): number => {
  const raw = Number(process.env.CHAT_AZURE_MIN_CONFIDENCE ?? '0.6');
  if (!Number.isFinite(raw)) {
    return 0.6;
  }
  return Math.max(0, Math.min(1, raw));
};

const appendFollowUpSuggestions = (response: ChatQueryResponse): ChatQueryResponse => {
  const firstItem = response.items[0] as { productName?: unknown } | undefined;
  const productName =
    typeof firstItem?.productName === 'string' && firstItem.productName.trim().length > 0
      ? firstItem.productName.trim()
      : null;

  const suggestions = productName
    ? [
        `novita su ${productName} negli ultimi 90 giorni`,
        `solo aggiornamenti GA per ${productName}`,
        `confronta ${productName} con le altre fonti`
      ]
    : [
        'mostrami solo le novita in GA negli ultimi 30 giorni',
        'quali sono le novita piu recenti per Microsoft 365',
        'confronta Microsoft, EOS e Fabric negli ultimi 3 mesi'
      ];

  const followUpBlock =
    '\n\nPuoi anche chiedermi:\n' + suggestions.map((s) => `- "${s}"`).join('\n');

  if (response.message.includes('Puoi anche chiedermi:')) {
    return response;
  }

  return {
    ...response,
    message: `${response.message}${followUpBlock}`
  };
};

export const runChatOrchestrator = async (
  request: ChatQueryRequest
): Promise<ChatQueryResponse> => {
  const startedAt = Date.now();
  let effectiveRequest = request;
  let localResponse = await runLocalChatEngine(effectiveRequest);

  if (!shouldUseAzure(request)) {
    void trackServerChatEvent({
      name: 'chat_query_completed',
      properties: {
        engine: 'local',
        fallbackUsed: 'false'
      },
      measurements: {
        latencyMs: Date.now() - startedAt
      }
    });
    return appendFollowUpSuggestions(localResponse);
  }

  try {
    // If local retrieval fails, ask Azure to normalize/refine the query and retry once.
    if (localResponse.items.length === 0 && localResponse.filterPatch.query) {
      const refined = await runAzureQueryRefiner(request.message);
      if (
        refined.confidence >= 0.6 &&
        refined.refinedQuery &&
        refined.refinedQuery.toLowerCase() !== request.message.trim().toLowerCase()
      ) {
        effectiveRequest = {
          ...request,
          message: refined.refinedQuery
        };
        localResponse = await runLocalChatEngine(effectiveRequest);
      }
    }

    const azure = await runAzureChatEngine({
      request: effectiveRequest,
      localResponse
    });

    if (azure.confidence < getConfidenceThreshold()) {
      void trackServerChatEvent({
        name: 'chat_query_completed',
        properties: {
          engine: 'local',
          fallbackUsed: 'true',
          fallbackReason: 'low_confidence'
        },
        measurements: {
          latencyMs: Date.now() - startedAt,
          confidence: azure.confidence
        }
      });
      return {
        ...localResponse,
        fallbackUsed: true
      };
    }

    const response: ChatQueryResponse = {
      ...localResponse,
      message: azure.message,
      engine: 'azure',
      fallbackUsed: false,
      confidence: azure.confidence,
      model: azure.model
    };
    void trackServerChatEvent({
      name: 'chat_query_completed',
      properties: {
        engine: 'azure',
        fallbackUsed: 'false',
        model: azure.model
      },
      measurements: {
        latencyMs: Date.now() - startedAt,
        confidence: azure.confidence
      }
    });
    return appendFollowUpSuggestions(response);
  } catch {
    void trackServerChatEvent({
      name: 'chat_query_completed',
      properties: {
        engine: 'local',
        fallbackUsed: 'true',
        fallbackReason: 'azure_error'
      },
      measurements: {
        latencyMs: Date.now() - startedAt
      }
    });
    return appendFollowUpSuggestions({
      ...localResponse,
      fallbackUsed: true
    });
  }
};
