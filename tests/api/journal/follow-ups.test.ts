import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'

let getHandler: (event: any) => Promise<any>
let patchHandler: (event: any) => Promise<any>
let Bitacora: any
let DiscordUser: any

const getUserSession = vi.fn()
const ADMIN = { user: { id: 'a-1', username: 'bernardo' } }

async function seedFollowUp(over: Record<string, any> = {}) {
    return Bitacora.create({
        discordUserId: 'u-1',
        type: 'image',
        content: 'bitacora/u-1/shot.png',
        adminId: 'a-1',
        adminUsername: 'bernardo',
        analysisStatus: 'done',
        analysisResult: { schema_version: '1.0', best_fit_category: 'cost_sensitivity' },
        followUpStatus: 'pending',
        followUpPriority: 'medium',
        ...over,
    })
}

beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!)

    //@ts-ignore
    ;({ Bitacora } = await import('#server/models/Bitacora.schema'))
    //@ts-ignore
    ;({ DiscordUser } = await import('#server/models/DiscordUser.schema'))
    vi.stubGlobal('getUserSession', getUserSession)

    const getMod = await import('#server/api/journal/follow-ups.get')
    const patchMod = await import('#server/api/journal/follow-ups/[entryId].patch')
    getHandler = getMod.default as any
    patchHandler = patchMod.default as any
})

afterAll(async () => {
    await mongoose.disconnect()
})

beforeEach(async () => {
    await Promise.all(
        Object.values(mongoose.connection.collections).map(c => c.deleteMany({}))
    )
    vi.mocked(globalThis.getRouterParam).mockReset()
    vi.mocked(globalThis.readBody).mockReset()
    vi.mocked(globalThis.getQuery).mockReset()
    vi.mocked(globalThis.getQuery).mockReturnValue({})
    getUserSession.mockReset()
    getUserSession.mockResolvedValue(ADMIN)
})

describe('GET /api/journal/follow-ups', () => {
    it('returns only pending follow-ups by default', async () => {
        await seedFollowUp({ followUpStatus: 'pending' })
        await seedFollowUp({ followUpStatus: 'done' })
        await seedFollowUp({ followUpStatus: null })   // never analyzed / no action

        const result = await getHandler({})

        expect(result).toHaveLength(1)
        expect(result[0].followUpStatus).toBe('pending')
    })

    it('filters to done, and returns every follow-up for status=all', async () => {
        await seedFollowUp({ followUpStatus: 'pending' })
        await seedFollowUp({ followUpStatus: 'done' })
        await seedFollowUp({ followUpStatus: null })

        vi.mocked(globalThis.getQuery).mockReturnValue({ status: 'done' })
        expect(await getHandler({})).toHaveLength(1)

        vi.mocked(globalThis.getQuery).mockReturnValue({ status: 'all' })
        const all = await getHandler({})
        expect(all).toHaveLength(2)
        expect(all.every((e: any) => e.followUpStatus !== null)).toBe(true)
    })

    it('sorts by priority, then soonest recontact date, with undated last', async () => {
        await seedFollowUp({ followUpPriority: 'low', recontactDate: new Date('2026-01-01') })
        await seedFollowUp({ followUpPriority: 'high', recontactDate: new Date('2026-05-01') })
        await seedFollowUp({ followUpPriority: 'high', recontactDate: new Date('2026-02-01') })
        await seedFollowUp({ followUpPriority: 'medium', recontactDate: null })
        await seedFollowUp({ followUpPriority: 'medium', recontactDate: new Date('2026-09-01') })

        const result = await getHandler({})

        expect(result.map((e: any) => [
            e.followUpPriority,
            e.recontactDate ? e.recontactDate.toISOString().slice(0, 10) : null,
        ])).toEqual([
            ['high', '2026-02-01'],
            ['high', '2026-05-01'],
            ['medium', '2026-09-01'],
            ['medium', null],
            ['low', '2026-01-01'],
        ])
    })

    it('joins the discord user, and nulls it when unknown', async () => {
        await DiscordUser.create({ _id: 'u-1', username: 'danih', roles: [] })
        await seedFollowUp({ followUpPriority: 'high' })
        await seedFollowUp({ discordUserId: 'ghost', followUpPriority: 'low' })

        const result = await getHandler({})

        expect(result[0].discordUser.username).toBe('danih')
        expect(result[1].discordUser).toBeNull()
    })

    it('rejects unauthenticated requests with 401', async () => {
        getUserSession.mockResolvedValue(null)
        await expect(getHandler({})).rejects.toMatchObject({ statusCode: 401 })
    })
})

describe('PATCH /api/journal/follow-ups/:entryId', () => {
    it('marks a follow-up done and records who did it', async () => {
        const entry = await seedFollowUp()
        vi.mocked(globalThis.getRouterParam).mockReturnValue(String(entry._id))
        vi.mocked(globalThis.readBody).mockResolvedValue({ status: 'done' })

        const result = await patchHandler({})

        expect(result.followUpStatus).toBe('done')
        expect(result.followUpDoneBy).toBe('bernardo')
        expect(result.followUpDoneAt).toBeTruthy()
    })

    it('clears the attribution when reopening', async () => {
        const entry = await seedFollowUp({
            followUpStatus: 'done',
            followUpDoneAt: new Date(),
            followUpDoneBy: 'bernardo',
        })
        vi.mocked(globalThis.getRouterParam).mockReturnValue(String(entry._id))
        vi.mocked(globalThis.readBody).mockResolvedValue({ status: 'pending' })

        const result = await patchHandler({})

        expect(result.followUpStatus).toBe('pending')
        expect(result.followUpDoneAt).toBeNull()
        expect(result.followUpDoneBy).toBeNull()
    })

    it('rejects an invalid status with 400', async () => {
        const entry = await seedFollowUp()
        vi.mocked(globalThis.getRouterParam).mockReturnValue(String(entry._id))
        vi.mocked(globalThis.readBody).mockResolvedValue({ status: 'archived' })

        await expect(patchHandler({})).rejects.toMatchObject({ statusCode: 400 })
    })

    it('returns 404 for an entry that has no follow-up', async () => {
        const entry = await seedFollowUp({ followUpStatus: null })
        vi.mocked(globalThis.getRouterParam).mockReturnValue(String(entry._id))
        vi.mocked(globalThis.readBody).mockResolvedValue({ status: 'done' })

        await expect(patchHandler({})).rejects.toMatchObject({ statusCode: 404 })
    })

    it('rejects unauthenticated requests with 401', async () => {
        const entry = await seedFollowUp()
        getUserSession.mockResolvedValue(null)
        vi.mocked(globalThis.getRouterParam).mockReturnValue(String(entry._id))
        vi.mocked(globalThis.readBody).mockResolvedValue({ status: 'done' })

        await expect(patchHandler({})).rejects.toMatchObject({ statusCode: 401 })
    })
})
