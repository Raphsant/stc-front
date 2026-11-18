// DELETE /api/billing/products/:id  →  deletes a product with no variants, archives any other (superadmin)
export default defineEventHandler((event) => billingSend(event, 'DELETE', `/services/${billingParam(event)}`))
