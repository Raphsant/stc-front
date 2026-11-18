// POST /api/billing/products/:id/sync  →  pushes the product and its variants to Stripe/PayPal (superadmin)
export default defineEventHandler((event) => billingSend(event, 'POST', `/services/${billingParam(event)}/sync`))
