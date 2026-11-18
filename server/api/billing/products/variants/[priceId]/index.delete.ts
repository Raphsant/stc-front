// DELETE /api/billing/products/variants/:priceId  →  only for a variant that was never sold (superadmin)
export default defineEventHandler((event) => billingSend(event, 'DELETE', `/prices/${billingParam(event, 'priceId')}`))
