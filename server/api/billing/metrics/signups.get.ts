// GET /api/billing/metrics/signups?from=&to=&groupBy=source|medium|campaign|affiliate
// Scope: metrics:counts.
export default defineEventHandler((event) =>
    metricsReport(event, 'signups', '/signups', metricsQuery(event, ['from', 'to', 'groupBy'], ['source', 'medium', 'campaign', 'affiliate'])),
)
