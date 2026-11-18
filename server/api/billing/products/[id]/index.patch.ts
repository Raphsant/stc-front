// PATCH /api/billing/products/:id  →  name, description, kind, tags, discordRoleId, active (superadmin)
export default defineEventHandler(async (event) =>
    billingSend(event, 'PATCH', `/services/${billingParam(event)}`, await billingBody(event)),
)
