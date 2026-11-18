// PATCH /api/billing/products/variants/:priceId  →  nickname, active, sortOrder, badgeMode, badgeText (superadmin)
export default defineEventHandler(async (event) =>
    billingSend(event, 'PATCH', `/prices/${billingParam(event, 'priceId')}`, await billingBody(event)),
)
