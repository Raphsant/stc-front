import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// The Productos proxy: reads for any staff session, writes only for superadmins,
// always with the stc-billing key and the staff username for its audit log.

// useRuntimeConfig is auto-imported from Nuxt, which has no instance here.
vi.mock('#app/nuxt', async (orig) => ({
    ...(await orig<any>()),
    useRuntimeConfig: () => ({ billingApiUrl: 'http://billing.test/', billingAdminApiKey: 'k' }),
}))

const getUserSession = vi.fn()
const fetchMock = vi.fn()
const SUPER = { user: { username: 'raph', role: 'superadmin' } }
const ADMIN = { user: { username: 'bernardo', role: 'admin' } }

let createProduct: (e: any) => Promise<any>
let addVariant: (e: any) => Promise<any>
let listProducts: (e: any) => Promise<any>
let replacePrice: (e: any) => Promise<any>

beforeAll(async () => {
    vi.stubGlobal('getUserSession', getUserSession)
    vi.stubGlobal('$fetch', fetchMock)
    const roles = await import('#server/utils/roles')
    const billing = await import('#server/utils/billing')
    vi.stubGlobal('requireSuperAdmin', roles.requireSuperAdmin)
    for (const [name, fn] of Object.entries(billing)) vi.stubGlobal(name, fn)

    createProduct = (await import('#server/api/billing/products/index.post')).default as any
    addVariant = (await import('#server/api/billing/products/[id]/variants.post')).default as any
    listProducts = (await import('#server/api/billing/products/index.get')).default as any
    replacePrice = (await import('#server/api/billing/products/variants/[priceId]/replace.post')).default as any
})

beforeEach(() => {
    getUserSession.mockReset().mockResolvedValue(SUPER)
    fetchMock.mockReset().mockResolvedValue({ ok: true })
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({})
    ;(globalThis as any).getQuery = vi.fn().mockReturnValue({})
    ;(globalThis as any).getRouterParam = vi.fn()
})

describe('products proxy', () => {
    it('refuses writes from a non-superadmin without calling stc-billing', async () => {
        getUserSession.mockResolvedValue(ADMIN)
        ;(globalThis as any).readBody.mockResolvedValue({ slug: 'delta', name: 'Delta' })
        await expect(createProduct({})).rejects.toMatchObject({ statusCode: 403 })
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('forwards a superadmin write with the key and the staff user', async () => {
        ;(globalThis as any).readBody.mockResolvedValue({ slug: 'delta', name: 'Delta', tags: ['vip'] })
        await createProduct({})
        expect(fetchMock).toHaveBeenCalledWith('/api/admin/services', expect.objectContaining({
            baseURL: 'http://billing.test',
            method: 'POST',
            body: { slug: 'delta', name: 'Delta', tags: ['vip'] },
            headers: { 'x-api-key': 'k', 'x-staff-user': 'raph' },
        }))
    })

    it('takes the product id for a new variant from the URL, not the body', async () => {
        ;(globalThis as any).getRouterParam.mockReturnValue('svc-1')
        ;(globalThis as any).readBody.mockResolvedValue({ serviceId: 'other', amount: 23760, interval: 'month', intervalCount: 3 })
        await addVariant({})
        expect(fetchMock).toHaveBeenCalledWith('/api/admin/prices', expect.objectContaining({
            method: 'POST',
            body: { serviceId: 'svc-1', amount: 23760, interval: 'month', intervalCount: 3 },
        }))
    })

    it('encodes the price id and never forwards a non-object body', async () => {
        ;(globalThis as any).getRouterParam.mockReturnValue('a/b')
        ;(globalThis as any).readBody.mockResolvedValue(['x'])
        await replacePrice({})
        expect(fetchMock).toHaveBeenCalledWith('/api/admin/prices/a%2Fb/replace', expect.objectContaining({ body: {} }))
    })

    it('lets any staff read, forwarding only archived and tag', async () => {
        getUserSession.mockResolvedValue(ADMIN)
        ;(globalThis as any).getQuery.mockReturnValue({ archived: '1', tag: 'vip', limit: '999' })
        await listProducts({})
        expect(fetchMock).toHaveBeenCalledWith('/api/admin/services', expect.objectContaining({
            method: 'GET',
            query: { archived: '1', tag: 'vip' },
        }))
    })

    it('turns an upstream validation error into the same status with its message', async () => {
        fetchMock.mockRejectedValue({ response: { status: 400 }, data: { message: 'slug: solo minúsculas' } })
        await expect(createProduct({})).rejects.toMatchObject({ statusCode: 400, statusMessage: 'slug: solo minúsculas' })
    })
})
