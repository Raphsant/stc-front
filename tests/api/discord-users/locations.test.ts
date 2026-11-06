import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'

let handler: (event: any) => Promise<any>
let DiscordUser: any

beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!)
    //@ts-ignore
    ;({ DiscordUser } = await import('#server/models/DiscordUser.schema'))
    vi.stubGlobal('DiscordUser', DiscordUser)

    const mod = await import('#server/api/discord-users/locations.get')
    handler = mod.default as any
})

afterAll(async () => {
    await mongoose.disconnect()
})

beforeEach(async () => {
    await Promise.all(
        Object.values(mongoose.connection.collections).map(c => c.deleteMany({}))
    )
    vi.mocked(globalThis.getQuery).mockReturnValue({})
})

async function seed(id: string, cfLocation: any, removedAt: Date | null = null) {
    return DiscordUser.create({ _id: id, username: id, cfLocation, removedAt })
}

describe('GET /api/discord-users/locations', () => {
    beforeEach(async () => {
        await seed('u1', { country: 'ES', region: 'Madrid', regionKey: 'M', city: 'Madrid', cityKey: 'madrid' })
        await seed('u2', { country: 'ES', region: 'Madrid', regionKey: 'M', city: 'MADRID', cityKey: 'madrid' })
        await seed('u3', { country: 'ES', region: 'Madrid', regionKey: 'M', city: 'Madrid', cityKey: 'madrid' })
        await seed('u4', { country: 'ES', region: 'Madrid', regionKey: 'M', city: 'Valdemoro', cityKey: 'valdemoro' })
        await seed('u5', { country: 'ES', region: 'Barcelona', regionKey: 'B', city: 'Barcelona', cityKey: 'barcelona' })
        await seed('u6', { country: 'US', region: 'Texas', regionKey: 'TX', city: 'Austin', cityKey: 'austin' }, new Date())
        await seed('u7', { country: 'ES', region: null, regionKey: null, city: 'Telde', cityKey: 'telde' })
        await DiscordUser.create({ _id: 'u8', username: 'u8' })
    })

    it('builds a country → region → city tree sorted by count', async () => {
        const result = await handler({})

        expect(result.noneCount).toBe(1)
        expect(result.countries.map((c: any) => [c.code, c.count])).toEqual([['ES', 6], ['US', 1]])

        const es = result.countries[0]
        expect(es.regions.map((r: any) => [r.key, r.name, r.count])).toEqual([
            ['M', 'Madrid', 4],
            ['B', 'Barcelona', 1],
            ['none', null, 1],
        ])
        // Most common spelling wins for display
        expect(es.regions[0].cities).toEqual([
            { key: 'madrid', name: 'Madrid', count: 3 },
            { key: 'valdemoro', name: 'Valdemoro', count: 1 },
        ])
    })

    it('scopes counts to the status filter', async () => {
        vi.mocked(globalThis.getQuery).mockReturnValue({ status: 'active' })
        const result = await handler({})
        expect(result.countries.map((c: any) => c.code)).toEqual(['ES'])

        vi.mocked(globalThis.getQuery).mockReturnValue({ status: 'removed' })
        const removed = await handler({})
        expect(removed.countries.map((c: any) => [c.code, c.count])).toEqual([['US', 1]])
        expect(removed.noneCount).toBe(0)
    })
})
