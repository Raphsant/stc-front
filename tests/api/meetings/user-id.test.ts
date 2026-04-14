import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'

let handler: (event: any) => Promise<any>
let ZoomLog: any

beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!)

    //@ts-ignore
    ;({ ZoomLog } = await import('#server/models/ZoomLog.schema'))
    vi.stubGlobal('ZoomLog', ZoomLog)

    const mod = await import('#server/api/meetings/user/[id].get')
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

describe('GET /api/meetings/user/:id', () => {
    it('returns meetings where the user is a participant', async () => {
        await ZoomLog.create({
            meetingId: 'm1', name: 'Meeting A',
            occurredAt: new Date('2024-03-01'), participants: ['user-99'],
        })
        await ZoomLog.create({
            meetingId: 'm2', name: 'Meeting B',
            occurredAt: new Date('2024-04-01'), participants: ['user-99'],
        })
        await ZoomLog.create({
            meetingId: 'm3', name: 'Other Meeting',
            occurredAt: new Date(), participants: ['user-00'],
        })

        vi.mocked(globalThis.getRouterParam).mockReturnValue('user-99')
        const result = await handler({})

        expect(result).toHaveLength(2)
        result.forEach((m: any) => expect(m.participants).toContain('user-99'))
    })

    it('returns an empty array when the user has no meetings', async () => {
        vi.mocked(globalThis.getRouterParam).mockReturnValue('user-unknown')
        const result = await handler({})
        expect(result).toEqual([])
    })

    it('returns meetings sorted newest first', async () => {
        await ZoomLog.create({
            meetingId: 'm-old', name: 'Old', occurredAt: new Date('2024-01-01'), participants: ['user-77'],
        })
        await ZoomLog.create({
            meetingId: 'm-new', name: 'New', occurredAt: new Date('2024-12-01'), participants: ['user-77'],
        })

        vi.mocked(globalThis.getRouterParam).mockReturnValue('user-77')
        const result = await handler({})

        expect(result[0].meetingId).toBe('m-new')
        expect(result[1].meetingId).toBe('m-old')
    })
})
