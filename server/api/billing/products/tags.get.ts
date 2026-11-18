// GET /api/billing/products/tags  →  every tag in use
export default defineEventHandler((event) => billingGet(event, '/services/tags'))
