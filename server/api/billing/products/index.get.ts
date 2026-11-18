// GET /api/billing/products?archived=1&tag=  →  stc-billing /api/admin/services
export default defineEventHandler((event) => {
    const q = getQuery(event)
    return billingGet(event, '/services', {
        archived: q.archived === '1' ? '1' : undefined,
        tag: typeof q.tag === 'string' && q.tag ? q.tag : undefined,
    })
})
