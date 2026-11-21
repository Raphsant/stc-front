// GET /api/billing/metrics/summary  →  stc-billing /api/admin/metrics/summary
// Scope: metrics:counts. Without metrics:money only the subscriber counts come back.
export default defineEventHandler((event) => metricsReport(event, 'summary', '/summary'))
