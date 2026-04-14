import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import mongoose from 'mongoose'

let handler: (event: any) => Promise<any>

beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!)

    const mod = await import('#server/api/bot/discord-info.get')
    handler = mod.default as any
})

afterAll(async () => {
    await mongoose.disconnect()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/bot/discord-info', () => {
    it('returns the data from the upstream endpoint', async () => {
        const fakeData = { memberCount: 42, onlineCount: 7 }
        vi.mocked(globalThis.$fetch).mockResolvedValue(fakeData)

        const result = await handler({})

        expect(result).toEqual(fakeData)
    })

    it('throws 503 when the upstream endpoint is unavailable', async () => {
        vi.mocked(globalThis.$fetch).mockRejectedValue(new Error('Network error'))

        await expect(handler({})).rejects.toMatchObject({ statusCode: 503 })
    })
})
