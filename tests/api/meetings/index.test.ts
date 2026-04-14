import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'

let handler: (event: any) => Promise<any>
let ZoomLog: any
let DiscordUser: any

beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!)

    //@ts-ignore
    ;({ ZoomLog } = await import('#server/models/ZoomLog.schema'))
    //@ts-ignore
    ;({ DiscordUser } = await import('#server/models/DiscordUser.schema'))
    vi.stubGlobal('ZoomLog', ZoomLog)
    vi.stubGlobal('DiscordUser', DiscordUser)

    const mod = await import('#server/api/meetings/index.get')
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

async function seedMeeting(overrides = {}) {
    return ZoomLog.create({
        meetingId: `m-${Date.now()}-${Math.random()}`,
        name: 'Test Meeting',
        occurredAt: new Date(),
        participants: [],
        ...overrides,
    })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/meetings', () => {
    it('returns an empty array when there are no meetings', async () => {
        vi.mocked(globalThis.getQuery).mockReturnValue({})
        const result = await handler({})
        expect(result).toEqual([])
    })

    it('returns all meetings sorted newest first', async () => {
        const older = await seedMeeting({ occurredAt: new Date('2024-01-01'), name: 'Old' })
        const newer = await seedMeeting({ occurredAt: new Date('2024-06-01'), name: 'New' })

        vi.mocked(globalThis.getQuery).mockReturnValue({})
        const result = await handler({})

        expect(result[0]._id.toString()).toBe(newer._id.toString())
        expect(result[1]._id.toString()).toBe(older._id.toString())
    })

    it('filters by userId when provided', async () => {
        // Populate replaces IDs with DiscordUser docs — seed the user so the ID survives.
        await DiscordUser.create({ _id: 'user-42', username: 'tester', roles: [], previousUsernames: [] })
        const unrelated = await seedMeeting({ participants: [] })
        const target = await seedMeeting({ participants: ['user-42'] })

        vi.mocked(globalThis.getQuery).mockReturnValue({ userId: 'user-42' })
        const result = await handler({})

        expect(result).toHaveLength(1)
        expect(result[0]._id.toString()).toBe(target._id.toString())
    })

    it('respects the limit query param', async () => {
        for (let i = 0; i < 5; i++) await seedMeeting()

        vi.mocked(globalThis.getQuery).mockReturnValue({ limit: '3' })
        const result = await handler({})

        expect(result).toHaveLength(3)
    })
})
