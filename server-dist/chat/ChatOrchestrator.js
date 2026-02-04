import { runAzureChatEngine } from './AzureChatEngine.js';
import { runLocalChatEngine } from './LocalChatEngine.js';
import { trackServerChatEvent } from './AzureTelemetry.js';
const shouldUseAzure = (request) => {
    if (request.preferAzure) {
        return true;
    }
    return (process.env.CHAT_ENGINE ?? 'local').toLowerCase() === 'azure';
};
const getConfidenceThreshold = () => {
    const raw = Number(process.env.CHAT_AZURE_MIN_CONFIDENCE ?? '0.6');
    if (!Number.isFinite(raw)) {
        return 0.6;
    }
    return Math.max(0, Math.min(1, raw));
};
export const runChatOrchestrator = async (request) => {
    const startedAt = Date.now();
    const localResponse = await runLocalChatEngine(request);
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
        return localResponse;
    }
    try {
        const azure = await runAzureChatEngine({
            request,
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
        const response = {
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
        return response;
    }
    catch {
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
        return {
            ...localResponse,
            fallbackUsed: true
        };
    }
};
