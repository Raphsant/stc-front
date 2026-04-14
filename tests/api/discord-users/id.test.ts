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

    const mod = await import('#server/api/discord-users/[id].get')
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
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/discord-users/:id', () => {
    it('returns the user with their meeting count', async () => {
        await DiscordUser.create({ _id: 'u-10', username: 'alice', roles: ['mod'], previousUsernames: [] })
        await ZoomLog.create({ meetingId: 'm-10', name: 'Sync', occurredAt: new Date(), participants: ['u-10'] })
        await ZoomLog.create({ meetingId: 'm-11', name: 'Sync', occurredAt: new Date(), participants: ['u-10'] })

        vi.mocked(globalThis.getRouterParam).mockReturnValue('u-10')
        const result = await handler({})

        expect(result._id).toBe('u-10')
        expect(result.username).toBe('alice')
        expect(result.meetingCount).toBe(2)
        // meetings array should be projected out
        expect(result.meetings).toBeUndefined()
    })

    it('throws 404 when the user does not exist', async () => {
        vi.mocked(globalThis.getRouterParam).mockReturnValue('nonexistent-id')

        await expect(handler({})).rejects.toMatchObject({
            statusCode: 404,
            message: 'User not found',
        })
    })

    it('returns meetingCount of 0 for a user with no meetings', async () => {
        await DiscordUser.create({ _id: 'u-11', username: 'bob', roles: [], previousUsernames: [] })

        vi.mocked(globalThis.getRouterParam).mockReturnValue('u-11')
        const result = await handler({})

        expect(result.meetingCount).toBe(0)
    })
})
