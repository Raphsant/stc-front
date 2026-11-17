const STATUSES = ['pending', 'paid', 'failed', 'canceled', 'refunded', 'expired'] as const

// GET /api/billing/orders?status=&limit=&offset=  →  stc-billing /api/admin/orders
export default defineEventHandler((event) =>
    billingGet(event, '/orders', billingListQuery(event, STATUSES)),
)
