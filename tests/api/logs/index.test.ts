import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'

let handler: (event: any) => Promise<any>
let DashBoardLog: any
let DiscordUser: any

beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!)

    //@ts-ignore
    ;({ DashBoardLog } = await import('#server/models/dashboardLog.schema'))
    //@ts-ignore
    ;({ DiscordUser } = await import('#server/models/DiscordUser.schema'))
    vi.stubGlobal('DashBoardLog', DashBoardLog)
    vi.stubGlobal('DiscordUser', DiscordUser)

    const mod = await import('#server/api/logs/index.get')
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

async function seedLog(userId: string, overrides: Record<string, any> = {}) {
    return DashBoardLog.create({
        userId,
        occurredAt: new Date(),
        logType: ['zoom-register'],
        ...overrides,
    })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/logs', () => {
    it('returns an empty array when there are no logs', async () => {
        const result = await handler({})
        expect(result).toEqual([])
    })

    it('returns logs sorted newest first', async () => {
        await seedLog('u1', { occurredAt: new Date('2024-01-01') })
        await seedLog('u1', { occurredAt: new Date('2024-06-01') })

        const result = await handler({})

        expect(new Date(result[0].occurredAt) >= new Date(result[1].occurredAt)).toBe(true)
    })

    it('defaults to a limit of 20', async () => {
        for (let i = 0; i < 25; i++) await seedLog(`u${i}`)

        vi.mocked(globalThis.getQuery).mockReturnValue({})
        const result = await handler({})

        expect(result).toHaveLength(20)
    })

    it('respects a custom limit query param', async () => {
        for (let i = 0; i < 10; i++) await seedLog(`u${i}`)

        vi.mocked(globalThis.getQuery).mockReturnValue({ limit: '5' })
        const result = await handler({})

        expect(result).toHaveLength(5)
    })
})
