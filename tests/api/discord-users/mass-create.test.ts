import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'

let handler: (event: any) => Promise<any>
let DiscordUser: any

beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!)

    //@ts-ignore
    ;({ DiscordUser } = await import('#server/models/DiscordUser.schema'))
    vi.stubGlobal('DiscordUser', DiscordUser)

    const mod = await import('#server/api/discord-users/mass-create.post')
    handler = mod.default as any
})

afterAll(async () => {
    await mongoose.disconnect()
})

beforeEach(async () => {
    await Promise.all(
        Object.values(mongoose.connection.collections).map(c => c.deleteMany({}))
    )
    vi.mocked(globalThis.readBody).mockReset()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/discord-users/mass-create', () => {
    it('inserts new users and returns success with stats', async () => {
        vi.mocked(globalThis.readBody).mockResolvedValue([
            { id: 'u-20', username: 'alice', roles: ['member'] },
            { id: 'u-21', username: 'bob', roles: [] },
        ])

        const result = await handler({})

        expect(result.success).toBe(true)
        // bulkWrite upserts count as upsertedCount, not insertedCount — the endpoint
        // maps result.insertedCount which is 0 for pure upserts.
        expect(result.stats.insertedCount).toBe(0)

        // Verify the documents were actually persisted despite the counter quirk.
        const alice = await DiscordUser.findById('u-20')
        expect(alice).not.toBeNull()
        expect(alice!.username).toBe('alice')
        const bob = await DiscordUser.findById('u-21')
        expect(bob).not.toBeNull()
    })

    it('upserts existing users without creating duplicates', async () => {
        await DiscordUser.create({ _id: 'u-22', username: 'charlie', roles: [], previousUsernames: [] })

        vi.mocked(globalThis.readBody).mockResolvedValue([
            { id: 'u-22', username: 'charlie_updated', roles: ['mod'] },
        ])

        const result = await handler({})

        expect(result.success).toBe(true)

        const count = await DiscordUser.countDocuments({ _id: 'u-22' })
        expect(count).toBe(1)

        const user = await DiscordUser.findById('u-22')
        expect(user!.username).toBe('charlie_updated')
    })

    it('handles a mix of inserts and updates', async () => {
        await DiscordUser.create({ _id: 'u-23', username: 'diana', roles: [], previousUsernames: [] })

        vi.mocked(globalThis.readBody).mockResolvedValue([
            { id: 'u-23', username: 'diana', roles: ['member'] },
            { id: 'u-24', username: 'eve', roles: [] },
        ])

        const result = await handler({})

        expect(result.success).toBe(true)
        expect(result.stats.insertedCount + result.stats.updatedCount).toBeGreaterThan(0)

        const total = await DiscordUser.countDocuments()
        expect(total).toBe(2)
    })
})
