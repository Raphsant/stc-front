import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'

let handler: (event: any) => Promise<any>
let DashBoardLog: any

beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!)

    //@ts-ignore
    ;({ DashBoardLog } = await import('#server/models/dashboardLog.schema'))
    vi.stubGlobal('DashBoardLog', DashBoardLog)

    const mod = await import('#server/api/logs/stats.get')
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

async function seedLog(occurredAt: Date, logType = 'zoom-register') {
    return DashBoardLog.create({
        userId: 'u-stats',
        occurredAt,
        logType: [logType],
    })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/logs/stats', () => {
    it('returns an empty array when there are no logs in range', async () => {
        vi.mocked(globalThis.getQuery).mockReturnValue({ period: 'daily' })
        const result = await handler({})
        expect(result).toEqual([])
    })

    it('returns daily counts within the last 30 days', async () => {
        const recent = new Date()
        recent.setDate(recent.getDate() - 2)
        await seedLog(recent)
        await seedLog(recent)

        vi.mocked(globalThis.getQuery).mockReturnValue({ period: 'daily' })
        const result = await handler({})

        const total = result.reduce((sum: number, r: any) => sum + r.count, 0)
        expect(total).toBe(2)
        expect(result[0]).toHaveProperty('date')
        expect(result[0]).toHaveProperty('count')
    })

    it('returns monthly counts when period=monthly', async () => {
        const thisMonth = new Date()
        await seedLog(thisMonth)
        await seedLog(thisMonth)

        vi.mocked(globalThis.getQuery).mockReturnValue({ period: 'monthly' })
        const result = await handler({})

        const total = result.reduce((sum: number, r: any) => sum + r.count, 0)
        expect(total).toBe(2)
    })

    it('respects custom from/to date range', async () => {
        await seedLog(new Date('2024-03-10'))
        await seedLog(new Date('2024-05-10'))
        await seedLog(new Date('2024-07-10'))

        vi.mocked(globalThis.getQuery).mockReturnValue({
            from: '2024-04-01',
            to: '2024-06-30',
        })
        const result = await handler({})

        const total = result.reduce((sum: number, r: any) => sum + r.count, 0)
        expect(total).toBe(1)
    })

    it('excludes non zoom-register log types', async () => {
        const recent = new Date()
        recent.setDate(recent.getDate() - 1)
        await seedLog(recent, 'zoom-register')
        await seedLog(recent, 'discord-command')

        vi.mocked(globalThis.getQuery).mockReturnValue({ period: 'daily' })
        const result = await handler({})

        const total = result.reduce((sum: number, r: any) => sum + r.count, 0)
        expect(total).toBe(1)
    })
})
