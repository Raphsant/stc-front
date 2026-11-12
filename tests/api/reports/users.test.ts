import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'

let handler: (event: any) => Promise<any>
let DiscordUser: any

const DAY = 24 * 60 * 60 * 1000
const inDays = (n: number) => new Date(Date.now() + n * DAY)

beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!)
    //@ts-ignore
    ;({ DiscordUser } = await import('#server/models/DiscordUser.schema'))
    vi.stubGlobal('DiscordUser', DiscordUser)

    const mod = await import('#server/api/reports/users.get')
    handler = mod.default as any
})

afterAll(async () => {
    await mongoose.disconnect()
})

const BCN = { country: 'ES', region: 'Barcelona', regionKey: 'B', city: 'Barcelona', cityKey: 'barcelona' }
const MAD = { country: 'ES', region: 'Madrid', regionKey: 'M', city: 'Madrid', cityKey: 'madrid' }
const cf = (days: number | null, status = 'active') => ({
    status, productName: 'Delta', expiresAt: days === null ? null : inDays(days), syncedAt: new Date(),
})

async function run(query: Record<string, string> = {}) {
    vi.mocked(globalThis.getQuery).mockReturnValue(query)
    return handler({})
}
const ids = (r: any) => r.rows.map((x: any) => x._id).sort()

beforeEach(async () => {
    await Promise.all(
        Object.values(mongoose.connection.collections).map(c => c.deleteMany({})),
    )
    const db = mongoose.connection
    await db.collection('memberships').deleteMany({})
    await db.collection('zoomLogs').deleteMany({})
    await db.collection('messageActivity').deleteMany({})
    await db.collection('bitacoras').deleteMany({})

    await DiscordUser.create([
        // Delta in Barcelona, expires in 10 days, recently active
        { _id: 'd1', username: 'delta-bcn-soon', roles: ['@everyone', 'Delta'], cfLocation: BCN, cfContactId: 11, cfMembership: cf(10) },
        // Delta in Barcelona, expires in 50 days
        { _id: 'd2', username: 'delta-bcn-later', roles: ['Delta.'], cfLocation: BCN, cfContactId: 12, cfMembership: cf(50) },
        // Delta in Madrid, already expired
        { _id: 'd3', username: 'delta-mad-expired', roles: ['Delta'], cfLocation: MAD, cfContactId: 13, cfMembership: cf(-3, 'canceled') },
        // Delta never synced, no location
        { _id: 'd4', username: 'delta-unsynced', roles: ['Delta'] },
        // Alpha with a memberships doc; its CF data must be ignored
        { _id: 'a1', username: 'alpha-bcn', roles: ['Alpha'], cfLocation: BCN, cfMembership: cf(5) },
        // Paused Alpha: role gone, still alpha through the memberships doc
        { _id: 'a2', username: 'alpha-paused', roles: ['@everyone'], cfLocation: MAD },
        // Removed from the server
        { _id: 'r1', username: 'gone', roles: ['Delta'], cfLocation: BCN, removedAt: new Date(), cfMembership: cf(10) },
        // No tier
        { _id: 'n1', username: 'nobody', roles: ['@everyone'], cfLocation: { country: 'US', region: 'Texas', regionKey: 'TX', city: 'Austin', cityKey: 'austin' } },
    ])
    await db.collection('memberships').insertMany([
        { _id: 'a1', status: 'active', expiresAt: inDays(200) },
        { _id: 'a2', status: 'paused', expiresAt: inDays(20) },
    ] as any[])
    await db.collection('zoomLogs').insertOne({ meetingId: 'm1', occurredAt: inDays(-2), participants: ['d1', 'a1'] })
    await db.collection('messageActivity').insertOne({
        userId: 'd2', date: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() - 20)),
        channelId: 'c', count: 7, lastMessageAt: inDays(-20),
    })
    await db.collection('bitacoras').insertOne({ discordUserId: 'd1', adminUsername: 'raph', type: 'text', content: 'x' })
})

describe('GET /api/reports/users', () => {
    it('defaults to members still in the server and reports the universe', async () => {
        const r = await run()
        expect(r.total).toBe(7)
        expect(r.universe).toBe(7)
        expect(ids(r)).not.toContain('r1')
        expect(r.summary.byTier).toEqual({ alpha: 2, delta: 4, none: 1 })
        expect(r.summary.byMember).toEqual({ active: 7, removed: 0 })
    })

    it('answers "Delta in Barcelona, Spain expiring within 30 days"', async () => {
        const r = await run({ country: 'ES', region: 'B', city: 'barcelona', tier: 'delta', expiry: 'next30' })
        expect(ids(r)).toEqual(['d1'])
        expect(r.universe).toBe(7)
        expect(r.rows[0]).toMatchObject({
            tier: 'delta', tierRole: 'Delta', memberStatus: 'active', cfLinked: true,
            engagement: 'active', meetingCount: 1, contactedBy: ['raph'],
            location: { country: 'ES', regionKey: 'B', cityKey: 'barcelona' },
            membership: { source: 'cf', status: 'active', daysLeft: 10 },
        })
    })

    it('resolves Alpha expiry from memberships, including paused Alphas', async () => {
        const r = await run({ tier: 'alpha' })
        expect(ids(r)).toEqual(['a1', 'a2'])
        const byId = Object.fromEntries(r.rows.map((x: any) => [x._id, x.membership]))
        expect(byId.a1).toMatchObject({ source: 'alpha', status: 'active', daysLeft: 200 })
        expect(byId.a2).toMatchObject({ source: 'alpha', status: 'paused', daysLeft: 20 })
    })

    it('filters by expiry window, plan status and missing dates', async () => {
        expect(ids(await run({ expiry: 'expired' }))).toEqual(['d3'])
        expect(ids(await run({ expiry: 'next60' }))).toEqual(['a2', 'd1', 'd2'])
        expect(ids(await run({ expiry: 'none' }))).toEqual(['d4', 'n1'])
        expect(ids(await run({ plan: 'canceled' }))).toEqual(['d3'])
    })

    it('filters by membership status, engagement and location', async () => {
        expect(ids(await run({ member: 'removed' }))).toEqual(['r1'])
        expect((await run({ member: 'all' })).total).toBe(8)
        expect(ids(await run({ engagement: 'active' }))).toEqual(['a1', 'd1'])
        expect(ids(await run({ engagement: 'slipping' }))).toEqual(['d2'])
        expect(ids(await run({ country: 'none' }))).toEqual(['d4'])
        expect(ids(await run({ country: 'ES', region: 'M' }))).toEqual(['a2', 'd3'])
    })

    it('filters by meetings, messages, contact and ClickFunnels link', async () => {
        expect(ids(await run({ meetingsMin: '1' }))).toEqual(['a1', 'd1'])
        expect((await run({ meetings: 'none' })).total).toBe(5)
        expect(ids(await run({ msgMin: '5' }))).toEqual(['d2'])
        expect(ids(await run({ contacted: 'yes' }))).toEqual(['d1'])
        expect((await run({ contacted: 'no' })).total).toBe(6)
        expect(ids(await run({ cf: 'linked' }))).toEqual(['d1', 'd2', 'd3'])
    })

    it('summarises by expiry bucket and drills location with the filter', async () => {
        const all = await run()
        expect(all.summary.byExpiry).toEqual({ expired: 1, d7: 0, d30: 2, d60: 1, d90: 0, later: 1, none: 2 })
        expect(all.summary.expiryCoverage).toEqual({ withDate: 5, withoutDate: 2 })
        expect(all.summary.byCountry).toEqual([
            { code: 'ES', count: 5 }, { code: 'US', count: 1 }, { code: null, count: 1 },
        ])
        expect(all.summary.byRegion).toEqual([])
        expect(all.summary.cfSyncedAt).toBeTruthy()

        const es = await run({ country: 'ES' })
        expect(es.summary.byRegion).toEqual([
            { key: 'B', name: 'Barcelona', count: 3 }, { key: 'M', name: 'Madrid', count: 2 },
        ])
        const bcn = await run({ country: 'ES', region: 'B' })
        expect(bcn.summary.byCity).toEqual([{ key: 'barcelona', name: 'Barcelona', count: 3 }])
    })

    it('sorts by expiry with undated rows last', async () => {
        const r = await run({ sortBy: 'expiresAt' })
        expect(r.rows.map((x: any) => x._id)).toEqual(['d3', 'd1', 'a2', 'd2', 'a1', 'd4', 'n1'])
    })

    it('treats the search text literally', async () => {
        expect(ids(await run({ q: 'delta-bcn' }))).toEqual(['d1', 'd2'])
        expect((await run({ q: '.*' })).total).toBe(0)
    })
})
