type ChatMetricType =
  | 'query_submitted'
  | 'response_received'
  | 'response_error'
  | 'filters_applied';

type MetricCounter = Record<ChatMetricType, number>;

type ChatMetricsSnapshot = {
  counters: MetricCounter;
  lastUpdatedAt: string;
};

const STORAGE_KEY = 'updatelens.chat.metrics.v1';

const defaultCounters = (): MetricCounter => ({
  query_submitted: 0,
  response_received: 0,
  response_error: 0,
  filters_applied: 0
});

const loadMetrics = (): ChatMetricsSnapshot => {
  if (typeof window === 'undefined') {
    return { counters: defaultCounters(), lastUpdatedAt: new Date().toISOString() };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { counters: defaultCounters(), lastUpdatedAt: new Date().toISOString() };
    }
    const parsed = JSON.parse(raw) as ChatMetricsSnapshot;
    return {
      counters: {
        ...defaultCounters(),
        ...(parsed.counters ?? {})
      },
      lastUpdatedAt: parsed.lastUpdatedAt ?? new Date().toISOString()
    };
  } catch {
    return { counters: defaultCounters(), lastUpdatedAt: new Date().toISOString() };
  }
};

const persistMetrics = (snapshot: ChatMetricsSnapshot) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
};

export const trackChatMetric = (
  type: ChatMetricType,
  payload?: Record<string, unknown>
) => {
  const snapshot = loadMetrics();
  snapshot.counters[type] += 1;
  snapshot.lastUpdatedAt = new Date().toISOString();
  persistMetrics(snapshot);

  // Placeholder transport for baseline; can be replaced by App Insights later.
  console.info('[ChatMetric]', {
    type,
    payload: payload ?? {},
    counters: snapshot.counters,
    at: snapshot.lastUpdatedAt
  });
};

export const getChatMetricsSnapshot = (): ChatMetricsSnapshot => loadMetrics();
