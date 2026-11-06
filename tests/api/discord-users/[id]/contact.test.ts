import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'

// useRuntimeConfig is auto-imported from Nuxt, which has no instance here.
vi.mock('#app/nuxt', async (orig) => ({
    ...(await orig<any>()),
    useRuntimeConfig: () => ({ cfToken: 'test-token', cfWorkspaceId: '99' }),
}))

let handler: (event: any) => Promise<any>
let DiscordUser: any
const fetchMock = vi.fn()

function jsonRes(status: number, body: any) {
    return { ok: status >= 200 && status < 300, status, json: async () => body }
}

beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!)
    //@ts-ignore
    ;({ DiscordUser } = await import('#server/models/DiscordUser.schema'))
    vi.stubGlobal('DiscordUser', DiscordUser)
    vi.stubGlobal('fetch', fetchMock)

    const mod = await import('#server/api/discord-users/[id]/contact.get')
    handler = mod.default as any
})

afterAll(async () => {
    await mongoose.disconnect()
})

beforeEach(async () => {
    await Promise.all(
        Object.values(mongoose.connection.collections).map(c => c.deleteMany({}))
    )
    vi.mocked(globalThis.getRouterParam).mockReset()
    fetchMock.mockReset()
})

describe('GET /api/discord-users/:id/contact', () => {
    it('404s for an unknown user', async () => {
        vi.mocked(globalThis.getRouterParam).mockReturnValue('nope')
        await expect(handler({})).rejects.toMatchObject({ statusCode: 404 })
    })

    it('returns linked:false without calling CF when there is no cfContactId', async () => {
        await DiscordUser.create({ _id: 'u1', username: 'alice' })
        vi.mocked(globalThis.getRouterParam).mockReturnValue('u1')

        expect(await handler({})).toEqual({ linked: false })
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns name, email, phone and the latest order address', async () => {
        await DiscordUser.create({ _id: 'u2', username: 'bob', cfContactId: 123 })
        vi.mocked(globalThis.getRouterParam).mockReturnValue('u2')
        fetchMock.mockImplementation(async (url: string) => {
            if (url.endsWith('/contacts/123')) {
                return jsonRes(200, {
                    id: 123, public_id: 'AbC12', workspace_id: 77, first_name: 'Bob ', last_name: 'Smith',
                    email_address: 'bob@example.com', phone_number: '+1 555 0100',
                })
            }
            return jsonRes(200, [
                { created_at: '2024-01-01T00:00:00Z', billing_address_street_one: 'Old St 1', billing_address_city: 'Oldtown' },
                {
                    created_at: '2025-01-01T00:00:00Z',
                    billing_address_street_one: '', billing_address_city: null,
                    shipping_address_street_one: 'New Ave 2', shipping_address_city: 'Madrid',
                    shipping_address_region: 'MD', shipping_address_postal_code: '28001', shipping_address_country: 'ES',
                },
            ])
        })

        const result = await handler({})

        expect(fetchMock.mock.calls[1][0]).toContain('/workspaces/77/orders?filter[contact_id]=123')
        expect(result).toEqual({
            linked: true,
            contactId: 123,
            profileUrl: 'https://eduardobricenosteam309bd.myclickfunnels.com/account/contacts/AbC12',
            fullName: 'Bob Smith',
            email: 'bob@example.com',
            phone: '+1 555 0100',
            address: {
                streetOne: 'New Ave 2', streetTwo: null, city: 'Madrid',
                region: 'MD', postalCode: '28001', country: 'ES',
            },
        })
    })

    it('still returns contact details when the orders call fails', async () => {
        await DiscordUser.create({ _id: 'u3', username: 'carol', cfContactId: 7 })
        vi.mocked(globalThis.getRouterParam).mockReturnValue('u3')
        fetchMock.mockImplementation(async (url: string) =>
            url.endsWith('/contacts/7')
                ? jsonRes(200, { id: 7, first_name: 'Carol', email_address: 'c@example.com' })
                : jsonRes(500, {}),
        )

        const result = await handler({})
        expect(result).toMatchObject({ linked: true, fullName: 'Carol', profileUrl: null, phone: null, address: null })
        // No workspace_id on the contact → falls back to the configured one
        expect(fetchMock.mock.calls[1][0]).toContain('/workspaces/99/orders')
    })

    it('flags a contact that no longer exists in CF', async () => {
        await DiscordUser.create({ _id: 'u4', username: 'dan', cfContactId: 8 })
        vi.mocked(globalThis.getRouterParam).mockReturnValue('u4')
        fetchMock.mockResolvedValue(jsonRes(404, {}))

        expect(await handler({})).toEqual({ linked: true, contactId: 8, missing: true })
    })

    it('502s on other CF errors', async () => {
        await DiscordUser.create({ _id: 'u5', username: 'eve', cfContactId: 9 })
        vi.mocked(globalThis.getRouterParam).mockReturnValue('u5')
        fetchMock.mockResolvedValue(jsonRes(500, {}))

        await expect(handler({})).rejects.toMatchObject({ statusCode: 502 })
    })
})
