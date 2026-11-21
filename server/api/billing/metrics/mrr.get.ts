// GET /api/billing/metrics/mrr?from=&to=&bucket=day|month&source=live|snapshot
// Scope: metrics:money (the whole report is dollars).
export default defineEventHandler((event) =>
    metricsReport(event, 'mrr', '/mrr', metricsQuery(event, ['from', 'to', 'bucket', 'source'])),
)
