export type MetricName =
  | "http_requests_total"
  | "http_request_errors_total"
  | "http_request_duration_ms"
  | "frontend_errors_total"
  | "web_vitals"
  | "db_query_duration_ms"
  | "db_errors_total"
  | "provider_requests_total"
  | "provider_failures_total"
  | "payment_operations_total"
  | "fulfillment_operations_total"
  | "shipping_operations_total"
  | "security_events_total"
  | "notification_operations_total";

export type MetricLabels = Readonly<Record<string, string>>;

const ALLOWED_LABELS = new Set(["route", "method", "status_class", "error_class", "provider", "operation", "environment", "metric"]);

export function boundedMetricLabels(labels: MetricLabels): MetricLabels {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(labels)) {
    if (!ALLOWED_LABELS.has(key)) continue;
    const normalized = value.trim().slice(0, 64);
    if (normalized) result[key] = normalized;
  }
  return result;
}

type CounterKey = string;
const counters = new Map<CounterKey, number>();

export function incrementMetric(name: MetricName, labels: MetricLabels = {}, amount = 1): void {
  const bounded = boundedMetricLabels(labels);
  const key = name + JSON.stringify(bounded);
  counters.set(key, (counters.get(key) ?? 0) + amount);
}

export function observeMetric(name: MetricName, value: number, labels: MetricLabels = {}): void {
  if (!Number.isFinite(value) || value < 0) return;
  incrementMetric(name, labels);
}

export function getMetricSnapshot(): Array<{ name: string; labels: MetricLabels; count: number }> {
  const result: Array<{ name: string; labels: MetricLabels; count: number }> = [];
  for (const [key, count] of counters) {
    const index = key.indexOf("{");
    const name = index >= 0 ? key.slice(0, index) : key;
    let labels: MetricLabels = {};
    try { labels = JSON.parse(index >= 0 ? key.slice(index) : "{}") as MetricLabels; } catch { labels = {}; }
    result.push({ name, labels, count });
  }
  return result;
}
