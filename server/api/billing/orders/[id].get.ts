// GET /api/billing/orders/:id  →  stc-billing /api/admin/orders/:id
export default defineEventHandler((event) =>
    billingGet(event, `/orders/${encodeURIComponent(getRouterParam(event, 'id') || '')}`),
)
