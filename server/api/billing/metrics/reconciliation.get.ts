// GET /api/billing/metrics/reconciliation?limit=
// The checks against Stripe and what did not match. Scope: metrics:admin.
export default defineEventHandler((event) =>
    metricsReport(event, 'reconciliation', '/reconciliation', metricsQuery(event, ['limit'])),
)
