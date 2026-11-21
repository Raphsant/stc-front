// GET /api/billing/metrics/churn?month=YYYY-MM
// Scope: metrics:counts. Without metrics:money the MRR lost is left out; counts and rates stay.
export default defineEventHandler((event) => metricsReport(event, 'churn', '/churn', metricsQuery(event, ['month'])))
