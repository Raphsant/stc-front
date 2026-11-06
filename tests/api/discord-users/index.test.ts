import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'

let handler: (event: any) => Promise<any>
let DiscordUser: any
let ZoomLog: any

beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!)

    //@ts-ignore
    ;({ DiscordUser } = await import('#server/models/DiscordUser.schema'))
    //@ts-ignore
    ;({ ZoomLog } = await import('#server/models/ZoomLog.schema'))
    vi.stubGlobal('DiscordUser', DiscordUser)
    vi.stubGlobal('ZoomLog', ZoomLog)

    const mod = await import('#server/api/discord-users/index.get')
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedUser(id: string, username: string) {
    return DiscordUser.create({ _id: id, username, roles: [], previousUsernames: [] })
}

async function seedMeeting(meetingId: string, occurredAt: Date, participants: string[]) {
    return ZoomLog.create({ meetingId, name: 'Test', occurredAt, participants })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/discord-users', () => {
    it('returns an empty array when there are no users', async () => {
        const result = await handler({})
        expect(result).toEqual([])
    })

    it('returns users with their meeting counts', async () => {
        await seedUser('u1', 'alice')
        await seedUser('u2', 'bob')
        await seedMeeting('m1', new Date(), ['u1'])
        await seedMeeting('m2', new Date(), ['u1'])
        await seedMeeting('m3', new Date(), ['u2'])

        const result = await handler({})

        const alice = result.find((u: any) => u._id === 'u1')
        const bob = result.find((u: any) => u._id === 'u2')
        expect(alice.meetingCount).toBe(2)
        expect(bob.meetingCount).toBe(1)
    })

    it('sorts by meetingCount descending', async () => {
        await seedUser('u3', 'charlie')
        await seedUser('u4', 'diana')
        await seedMeeting('m4', new Date(), ['u4'])
        await seedMeeting('m5', new Date(), ['u4'])

        const result = await handler({})
        expect(result[0]._id).toBe('u4')
        expect(result[1]._id).toBe('u3')
    })

    it('filters meeting count by from date', async () => {
        await seedUser('u5', 'eve')
        await seedMeeting('m6', new Date('2024-01-15'), ['u5'])
        await seedMeeting('m7', new Date('2024-06-15'), ['u5'])

        vi.mocked(globalThis.getQuery).mockReturnValue({ from: '2024-04-01' })
        const result = await handler({})

        const eve = result.find((u: any) => u._id === 'u5')
        expect(eve.meetingCount).toBe(1)
    })

    it('filters meeting count by to date', async () => {
        await seedUser('u6', 'frank')
        await seedMeeting('m8', new Date('2024-01-15'), ['u6'])
        await seedMeeting('m9', new Date('2024-06-15'), ['u6'])

        vi.mocked(globalThis.getQuery).mockReturnValue({ to: '2024-03-01' })
        const result = await handler({})

        const frank = result.find((u: any) => u._id === 'u6')
        expect(frank.meetingCount).toBe(1)
    })

    describe('status filter', () => {
        beforeEach(async () => {
            // removedAt: null (schema default / rejoined member)
            await seedUser('a1', 'active-null')
            // legacy record with no removedAt field at all
            await DiscordUser.collection.insertOne({ _id: 'a2', username: 'active-missing', roles: [], previousUsernames: [] })
            await DiscordUser.create({ _id: 'r1', username: 'removed', roles: [], previousUsernames: [], removedAt: new Date('2025-01-01') })
        })

        const ids = (rows: any[]) => rows.map((u: any) => u._id).sort()

        it('status=active returns users with null or missing removedAt', async () => {
            vi.mocked(globalThis.getQuery).mockReturnValue({ status: 'active' })
            expect(ids(await handler({}))).toEqual(['a1', 'a2'])
        })

        it('status=removed returns only users with a removedAt date', async () => {
            vi.mocked(globalThis.getQuery).mockReturnValue({ status: 'removed' })
            expect(ids(await handler({}))).toEqual(['r1'])
        })

        it('no status returns everyone', async () => {
            expect(ids(await handler({}))).toEqual(['a1', 'a2', 'r1'])
        })
    })

    describe('location filter', () => {
        const loc = (country: string | null, regionKey: string | null, cityKey: string | null) =>
            ({ country, region: null, regionKey, city: null, cityKey, syncedAt: null })

        beforeEach(async () => {
            await DiscordUser.create({ _id: 'mad', username: 'mad', cfLocation: loc('ES', 'M', 'madrid') })
            await DiscordUser.create({ _id: 'val', username: 'val', cfLocation: loc('ES', 'M', 'valdemoro') })
            await DiscordUser.create({ _id: 'bcn', username: 'bcn', cfLocation: loc('ES', 'B', 'barcelona') })
            await DiscordUser.create({ _id: 'tx',  username: 'tx',  cfLocation: loc('US', 'TX', 'austin') })
            await seedUser('nowhere', 'nowhere')
        })

        const ids = (rows: any[]) => rows.map((u: any) => u._id).sort()
        const run = async (q: any) => {
            vi.mocked(globalThis.getQuery).mockReturnValue(q)
            return ids(await handler({}))
        }

        it('filters by country', async () => {
            expect(await run({ country: 'ES' })).toEqual(['bcn', 'mad', 'val'])
        })

        it('filters by country + region', async () => {
            expect(await run({ country: 'ES', region: 'M' })).toEqual(['mad', 'val'])
        })

        it('filters by country + region + city', async () => {
            expect(await run({ country: 'ES', region: 'M', city: 'valdemoro' })).toEqual(['val'])
        })

        it('country=none returns users with no known location', async () => {
            expect(await run({ country: 'none' })).toEqual(['nowhere'])
        })

        it('ignores region/city without a country', async () => {
            expect(await run({ region: 'M', city: 'madrid' })).toHaveLength(5)
        })
    })
})
