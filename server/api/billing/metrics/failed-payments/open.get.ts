// GET /api/billing/metrics/failed-payments/open
// The drill-down with names and emails. Scope: metrics:members.
export default defineEventHandler((event) => metricsReport(event, 'failed-payments-open', '/failed-payments/open'))
