import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'

let handler: (event: any) => Promise<any>
let ZoomLog: any

beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!)

    //@ts-ignore
    ;({ ZoomLog } = await import('#server/models/ZoomLog.schema'))
    // DiscordUser must be registered so populate('participants') can resolve refs.
    //@ts-ignore
    const { DiscordUser } = await import('#server/models/DiscordUser.schema')
    vi.stubGlobal('ZoomLog', ZoomLog)
    vi.stubGlobal('DiscordUser', DiscordUser)

    const mod = await import('#server/api/meetings/[id].get')
    handler = mod.default as any
})

afterAll(async () => {
    await mongoose.disconnect()
})

beforeEach(async () => {
    await Promise.all(
        Object.values(mongoose.connection.collections).map(c => c.deleteMany({}))
    )
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/meetings/:id', () => {
    it('returns the meeting when it exists', async () => {
        const meeting = await ZoomLog.create({
            meetingId: 'abc-123',
            name: 'Weekly Sync',
            occurredAt: new Date(),
            participants: [],
        })

        const result = await handler({ context: { params: { id: meeting._id.toString() } } })

        expect(result._id.toString()).toBe(meeting._id.toString())
        expect(result.name).toBe('Weekly Sync')
    })

    it('throws when the meeting does not exist', async () => {
        const fakeId = new mongoose.Types.ObjectId().toString()

        // The endpoint catches the 404 and re-throws as 500 with the original message.
        await expect(
            handler({ context: { params: { id: fakeId } } })
        ).rejects.toMatchObject({ statusCode: 500, message: 'Meeting not found' })
    })
})
