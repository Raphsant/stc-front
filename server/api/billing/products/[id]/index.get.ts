// GET /api/billing/products/:id  →  stc-billing /api/admin/services/:id
export default defineEventHandler((event) => billingGet(event, `/services/${billingParam(event)}`))
