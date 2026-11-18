// POST /api/billing/products/variants/:priceId/replace { amount }  →  price change (superadmin).
// Current subscribers stay on the old amount.
export default defineEventHandler(async (event) =>
    billingSend(event, 'POST', `/prices/${billingParam(event, 'priceId')}/replace`, await billingBody(event)),
)
