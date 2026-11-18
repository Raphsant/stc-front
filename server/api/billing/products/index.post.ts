// POST /api/billing/products  →  stc-billing POST /api/admin/services (superadmin)
export default defineEventHandler(async (event) =>
    billingSend(event, 'POST', '/services', await billingBody(event)),
)
