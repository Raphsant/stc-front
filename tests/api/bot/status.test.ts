import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import mongoose from 'mongoose'

let handler: (event: any) => Promise<any>

beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!)

    const mod = await import('#server/api/bot/status.get')
    handler = mod.default as any
})

afterAll(async () => {
    await mongoose.disconnect()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/bot/status', () => {
    it('returns the bot status when the health endpoint responds', async () => {
        const fakeStatus = { status: 'ok', uptime: 12345 }
        vi.mocked(globalThis.$fetch).mockResolvedValue(fakeStatus)

        const result = await handler({})

        expect(result).toEqual(fakeStatus)
    })

    it('throws 503 when the bot is unreachable', async () => {
        vi.mocked(globalThis.$fetch).mockRejectedValue(new Error('ECONNREFUSED'))

        await expect(handler({})).rejects.toMatchObject({ status: 503 })
    })
})
