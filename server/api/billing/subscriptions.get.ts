const STATUSES = ['incomplete', 'active', 'past_due', 'canceled', 'expired'] as const

// GET /api/billing/subscriptions?status=&limit=&offset=  →  stc-billing /api/admin/subscriptions
export default defineEventHandler((event) =>
    billingGet(event, '/subscriptions', billingListQuery(event, STATUSES)),
)
