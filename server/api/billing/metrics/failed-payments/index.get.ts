// GET /api/billing/metrics/failed-payments?month=YYYY-MM
// Scope: metrics:counts. Without metrics:money the amounts are left out.
export default defineEventHandler((event) =>
    metricsReport(event, 'failed-payments', '/failed-payments', metricsQuery(event, ['month'])),
)
