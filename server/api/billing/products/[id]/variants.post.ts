// POST /api/billing/products/:id/variants  →  stc-billing POST /api/admin/prices for this product (superadmin)
export default defineEventHandler(async (event) => {
    const body = await billingBody(event)
    return billingSend(event, 'POST', '/prices', { ...body, serviceId: getRouterParam(event, 'id') })
})
