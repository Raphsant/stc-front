// GET /api/billing/metrics/revenue?from=&to=&groupBy=product|provider|kind
// Scope: metrics:money.
export default defineEventHandler((event) =>
    metricsReport(event, 'revenue', '/revenue', metricsQuery(event, ['from', 'to', 'groupBy'], ['product', 'provider', 'kind'])),
)
