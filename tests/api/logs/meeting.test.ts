import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'

let handler: (event: any) => Promise<any>

beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!)

    // Import models so they register with mongoose via the #nuxt/mongoose mock.
    // Dynamic imports ensure the connection is open first.
    //@ts-ignore
    const { ZoomLog } = await import('#server/models/ZoomLog.schema')
    //@ts-ignore
    const { DiscordUser } = await import('#server/models/DiscordUser.schema')

    vi.stubGlobal('ZoomLog', ZoomLog)
    vi.stubGlobal('DiscordUser', DiscordUser)

    // Import handler after all globals are in place.
    const mod = await import('#server/api/logs/meeting.post')
    handler = mod.default as any
})

afterAll(async () => {
    await mongoose.disconnect()
})

beforeEach(async () => {
    // Clear all collections between tests for isolation.
    await Promise.all(
        Object.values(mongoose.connection.collections).map(col => col.deleteMany({}))
    )
    vi.mocked(globalThis.readBody).mockReset()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent() {
    return {} // readBody is mocked globally so the event object is irrelevant
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('POST /api/logs/meeting – validation', () => {
    it('throws 400 when meetingId is missing', async () => {
        vi.mocked(globalThis.readBody).mockResolvedValue({ startTime: '1700000000' })

        await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
    })

    it('throws 400 when startTime is missing', async () => {
        vi.mocked(globalThis.readBody).mockResolvedValue({ meetingId: 'meeting-1' })

        await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
    })

    it('throws 400 when both required fields are missing', async () => {
        vi.mocked(globalThis.readBody).mockResolvedValue({})

        await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 400 })
    })
})

// ---------------------------------------------------------------------------
// ZoomLog creation
// ---------------------------------------------------------------------------

describe('POST /api/logs/meeting – ZoomLog', () => {
    it('creates a new ZoomLog when none exists', async () => {
        vi.mocked(globalThis.readBody).mockResolvedValue({
            meetingId: 'meeting-1',
            name: 'Weekly Standup',
            startTime: '1700000000',
        })

        const result = await handler(makeEvent())

        expect(result.success).toBe(true)
        expect(result.log.meetingId).toBe('meeting-1')
        expect(result.log.name).toBe('Weekly Standup')
        expect(result.log.participants).toHaveLength(0)
    })

    it('reuses an existing ZoomLog for the same meetingId + startTime', async () => {
        const body = { meetingId: 'meeting-2', name: 'Retrospective', startTime: '1700001000' }

        vi.mocked(globalThis.readBody).mockResolvedValue(body)
        await handler(makeEvent())

        vi.mocked(globalThis.readBody).mockResolvedValue(body)
        const result = await handler(makeEvent())

        expect(result.success).toBe(true)

        const count = await (globalThis.ZoomLog as typeof mongoose.Model).countDocuments({
            meetingId: 'meeting-2',
        })
        expect(count).toBe(1)
    })

    it('creates separate ZoomLogs for the same meetingId with different startTimes', async () => {
        const base = { meetingId: 'meeting-3', name: 'Planning' }

        vi.mocked(globalThis.readBody).mockResolvedValue({ ...base, startTime: '1700002000' })
        await handler(makeEvent())

        vi.mocked(globalThis.readBody).mockResolvedValue({ ...base, startTime: '1700003000' })
        await handler(makeEvent())

        const count = await (globalThis.ZoomLog as typeof mongoose.Model).countDocuments({
            meetingId: 'meeting-3',
        })
        expect(count).toBe(2)
    })
})

// ---------------------------------------------------------------------------
// DiscordUser handling
// ---------------------------------------------------------------------------

describe('POST /api/logs/meeting – discordUser', () => {
    const baseBody = {
        meetingId: 'meeting-10',
        name: 'Team Sync',
        startTime: '1700010000',
    }

    it('creates a new DiscordUser and adds them as a participant', async () => {
        vi.mocked(globalThis.readBody).mockResolvedValue({
            ...baseBody,
            discordUser: { id: 'user-1', username: 'alice', roles: ['member'] },
        })

        const result = await handler(makeEvent())

        expect(result.log.participants).toContain('user-1')

        const user = await (globalThis.DiscordUser as typeof mongoose.Model).findById('user-1')
        expect(user).not.toBeNull()
        expect(user!.username).toBe('alice')
        expect(user!.roles).toContain('member')
    })

    it('does not duplicate a participant on repeated calls', async () => {
        const body = {
            ...baseBody,
            meetingId: 'meeting-11',
            discordUser: { id: 'user-2', username: 'bob', roles: [] },
        }

        vi.mocked(globalThis.readBody).mockResolvedValue(body)
        await handler(makeEvent())

        vi.mocked(globalThis.readBody).mockResolvedValue(body)
        await handler(makeEvent())

        const log = await (globalThis.ZoomLog as typeof mongoose.Model).findOne({
            meetingId: 'meeting-11',
        })
        expect(log!.participants.filter((p: string) => p === 'user-2')).toHaveLength(1)
    })

    it('updates username and tracks previous username when user rejoins under a new name', async () => {
        const userId = 'user-3'

        vi.mocked(globalThis.readBody).mockResolvedValue({
            ...baseBody,
            meetingId: 'meeting-12',
            discordUser: { id: userId, username: 'charlie', roles: [] },
        })
        await handler(makeEvent())

        vi.mocked(globalThis.readBody).mockResolvedValue({
            ...baseBody,
            meetingId: 'meeting-13',
            startTime: '1700020000',
            discordUser: { id: userId, username: 'charlie_v2', roles: [] },
        })
        await handler(makeEvent())

        const user = await (globalThis.DiscordUser as typeof mongoose.Model).findById(userId)
        expect(user!.username).toBe('charlie_v2')
        expect(user!.previousUsernames).toContain('charlie')
    })

    it('updates roles when provided on an existing user', async () => {
        const userId = 'user-4'

        vi.mocked(globalThis.readBody).mockResolvedValue({
            ...baseBody,
            meetingId: 'meeting-14',
            discordUser: { id: userId, username: 'diana', roles: ['member'] },
        })
        await handler(makeEvent())

        vi.mocked(globalThis.readBody).mockResolvedValue({
            ...baseBody,
            meetingId: 'meeting-15',
            startTime: '1700030000',
            discordUser: { id: userId, username: 'diana', roles: ['member', 'mod'] },
        })
        await handler(makeEvent())

        const user = await (globalThis.DiscordUser as typeof mongoose.Model).findById(userId)
        expect(user!.roles).toContain('mod')
    })

    it('creates a DashBoardLog entry on each registration', async () => {
        const { DashBoardLog } = await import('#server/models/dashboardLog.schema')

        vi.mocked(globalThis.readBody).mockResolvedValue({
            ...baseBody,
            meetingId: 'meeting-16',
            discordUser: { id: 'user-5', username: 'eve', roles: [] },
        })
        await handler(makeEvent())

        const entry = await (DashBoardLog as any).findOne({ userId: 'user-5' })
        expect(entry).not.toBeNull()
        expect(entry!.logType).toContain('zoom-register')
        expect(entry!.meetingId).toBe('meeting-16')
    })

    it('does not create a DashBoardLog when no discordUser is provided', async () => {
        const { DashBoardLog } = await import('#server/models/dashboardLog.schema')

        vi.mocked(globalThis.readBody).mockResolvedValue({
            ...baseBody,
            meetingId: 'meeting-17',
        })
        await handler(makeEvent())

        const count = await (DashBoardLog as any).countDocuments()
        expect(count).toBe(0)
    })
})
