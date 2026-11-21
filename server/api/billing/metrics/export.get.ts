// GET /api/billing/metrics/export?report=<name>&…  →  CSV
// Scope: metrics:export, the report's own scope, and metrics:money when the file holds dollars.
export default defineEventHandler((event) => metricsExport(event))
