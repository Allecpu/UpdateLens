import { app, HttpRequest, HttpResponseInit, InvocationContext, Timer } from '@azure/functions';
import { ensureContainer } from '../shared/blobStorage.js';
import { refreshMicrosoft, refreshEos, refreshFabric, refreshM365Roadmap } from '../refresh/index.js';
import type { RefreshResult } from '../shared/types.js';

type RefreshAllResponse = {
  completedAt: string;
  results: RefreshResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
};

/**
 * Run all refresh jobs in parallel and collect results
 */
async function runAllRefreshes(context: InvocationContext): Promise<RefreshAllResponse> {
  context.log('[RefreshAll] Starting all refresh jobs...');

  // Ensure blob storage container exists
  await ensureContainer();

  // Run all refreshes in parallel
  const results = await Promise.allSettled([
    refreshMicrosoft(),
    refreshEos(),
    refreshFabric(),
    refreshM365Roadmap()
  ]);

  // Extract results from settled promises
  const refreshResults: RefreshResult[] = results.map((result, index) => {
    const sources: Array<RefreshResult['source']> = ['microsoft', 'eos', 'fabric', 'm365roadmap'];

    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      // Handle rejected promises
      return {
        source: sources[index],
        status: 'failed' as const,
        itemCount: null,
        duration: 0,
        timestamp: new Date().toISOString(),
        error: result.reason instanceof Error ? result.reason.message : 'Promise rejected'
      };
    }
  });

  const summary = {
    total: refreshResults.length,
    successful: refreshResults.filter((r) => r.status === 'ok').length,
    failed: refreshResults.filter((r) => r.status === 'failed').length
  };

  context.log(`[RefreshAll] Completed: ${summary.successful}/${summary.total} successful`);

  return {
    completedAt: new Date().toISOString(),
    results: refreshResults,
    summary
  };
}

/**
 * HTTP Trigger - for manual refresh via API or UI button
 */
export async function refreshAllHttp(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('[RefreshAll] HTTP trigger invoked');

  try {
    const response = await runAllRefreshes(context);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(response)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    context.error(`[RefreshAll] Error: ${message}`);

    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: message,
        timestamp: new Date().toISOString()
      })
    };
  }
}

/**
 * Timer Trigger - monthly scheduled refresh (1st day of month, 02:00 UTC)
 */
export async function refreshAllTimer(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  context.log('[RefreshAll] Timer trigger invoked');
  context.log(`[RefreshAll] Timer past due: ${myTimer.isPastDue}`);

  try {
    const response = await runAllRefreshes(context);
    context.log(`[RefreshAll] Timer completed: ${JSON.stringify(response.summary)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    context.error(`[RefreshAll] Timer error: ${message}`);
    throw error; // Re-throw to mark the execution as failed
  }
}

// Register HTTP trigger
app.http('refreshAll', {
  methods: ['POST', 'GET'],
  authLevel: 'function',
  handler: refreshAllHttp
});

// Register Timer trigger - runs at 02:00 UTC on the 1st day of each month
app.timer('refreshAllScheduled', {
  schedule: '0 0 2 1 * *',
  handler: refreshAllTimer
});
