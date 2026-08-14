import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'

let analyzeHandler: (event: any) => Promise<any>
let Bitacora: any

const getUserSession = vi.fn()
const getObjectBuffer = vi.fn()
const analyzeConversation = vi.fn()

const ADMIN = { user: { id: 'a-1', username: 'bernardo' } }

/** Minimal well-formed Delta result; override what a test cares about. */
function deltaResult(overrides: Record<string, any> = {}) {
    return {
        schema_version: '1.0',
        customer_name: 'DaniH',
        discord_user: 'danih',
        agent_name: 'bernardo',
        conversation_channel: 'discord',
        conversation_last_message_date: '2026-06-08',
        best_fit_category: 'showing_results_positive',
        additional_categories: [],
        comparison_sentiment: null,
        newly_detected_pattern: null,
        alpha_fit_signal: 'strong',
        key_customer_quote: 'todo bien',
        forensic_analysis: 'Positive thread closed without a next step.',
        what_agent_did_well: ['Warm acknowledgement'],
        guideline_improvements: ['No forward step'],
        follow_up: {
            action_type: 'plant_alpha_seed',
            objective: 'Offer to explain Alpha.',
            suggested_message_es: 'Esos resultados hablan solos.',
        },
        suggested_recontact_date: '2026-06-16',
        recontact_rationale: 'Plant-seed cadence.',
        priority: 'high',
        status: 'pending',
        data_quality_flags: [],
        ...overrides,
    }
}

async function seedImageEntry(extra: Record<string, any> = {}) {
    return Bitacora.create({
        discordUserId: 'u-1',
        type: 'image',
        content: 'bitacora/u-1/shot.png',
        adminId: 'a-1',
        adminUsername: 'bernardo',
        ...extra,
    })
}

function routeTo(entryId: string, userId = 'u-1') {
    vi.mocked(globalThis.getRouterParam).mockImplementation(
        (_e: any, name: string) => (name === 'id' ? userId : entryId),
    )
}

beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!)

    //@ts-ignore
    ;({ Bitacora } = await import('#server/models/Bitacora.schema'))
    vi.stubGlobal('Bitacora', Bitacora)
    vi.stubGlobal('getUserSession', getUserSession)
    vi.stubGlobal('getObjectBuffer', getObjectBuffer)
    vi.stubGlobal('analyzeConversation', analyzeConversation)

    const mod = await import('#server/api/discord-users/[id]/journal/[entryId]/analyze.post')
    analyzeHandler = mod.default as any
})

afterAll(async () => {
    await mongoose.disconnect()
})

beforeEach(async () => {
    await Promise.all(
        Object.values(mongoose.connection.collections).map(c => c.deleteMany({}))
    )
    vi.mocked(globalThis.getRouterParam).mockReset()
    getUserSession.mockReset()
    getObjectBuffer.mockReset()
    analyzeConversation.mockReset()

    getUserSession.mockResolvedValue(ADMIN)
    getObjectBuffer.mockResolvedValue({ buffer: Buffer.from('img'), contentType: 'image/png' })
})

describe('POST /api/discord-users/:id/journal/:entryId/analyze', () => {
    it('stores the analysis and promotes the follow-up fields', async () => {
        const entry = await seedImageEntry()
        analyzeConversation.mockResolvedValue(deltaResult())
        routeTo(String(entry._id))

        const result = await analyzeHandler({})

        expect(result.analysisStatus).toBe('done')
        expect(result.analysisResult.best_fit_category).toBe('showing_results_positive')
        expect(result.analysisError).toBeNull()
        expect(result.analyzedAt).toBeTruthy()

        const saved = await Bitacora.findById(entry._id).lean()
        expect(saved.followUpStatus).toBe('pending')
        expect(saved.followUpPriority).toBe('high')
        expect(saved.recontactDate).toBeInstanceOf(Date)
        expect(saved.recontactDate.toISOString().slice(0, 10)).toBe('2026-06-16')
    })

    it('passes the run date and the uploading admin as the agent hint', async () => {
        const entry = await seedImageEntry({ adminUsername: 'rumi' })
        analyzeConversation.mockResolvedValue(deltaResult())
        routeTo(String(entry._id))

        await analyzeHandler({})

        const [, , ctx] = analyzeConversation.mock.calls[0]
        expect(ctx.agentName).toBe('rumi')
        expect(ctx.currentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('keeps a no_action_needed result out of the queue', async () => {
        const entry = await seedImageEntry()
        analyzeConversation.mockResolvedValue(deltaResult({
            follow_up: { action_type: 'no_action_needed', objective: 'Nothing to advance.', suggested_message_es: '' },
        }))
        routeTo(String(entry._id))

        await analyzeHandler({})

        const saved = await Bitacora.findById(entry._id).lean()
        expect(saved.analysisStatus).toBe('done')
        expect(saved.followUpStatus).toBeNull()
    })

    it('clears previous done-attribution when re-analyzing', async () => {
        const entry = await seedImageEntry({
            analysisStatus: 'done',
            followUpStatus: 'done',
            followUpDoneAt: new Date('2026-01-01'),
            followUpDoneBy: 'someone',
        })
        analyzeConversation.mockResolvedValue(deltaResult())
        routeTo(String(entry._id))

        await analyzeHandler({})

        const saved = await Bitacora.findById(entry._id).lean()
        expect(saved.followUpStatus).toBe('pending')
        expect(saved.followUpDoneAt).toBeNull()
        expect(saved.followUpDoneBy).toBeNull()
    })

    it('records the failure on the entry and throws 502 when the AI call fails', async () => {
        const entry = await seedImageEntry()
        analyzeConversation.mockRejectedValue(new Error('upstream exploded'))
        routeTo(String(entry._id))

        await expect(analyzeHandler({})).rejects.toMatchObject({ statusCode: 502 })

        const saved = await Bitacora.findById(entry._id).lean()
        expect(saved.analysisStatus).toBe('error')
        expect(saved.analysisError).toBe('upstream exploded')
    })

    it('rejects a second run while one is already in flight with 409', async () => {
        const entry = await seedImageEntry({ analysisStatus: 'pending' })
        routeTo(String(entry._id))

        await expect(analyzeHandler({})).rejects.toMatchObject({ statusCode: 409 })
        expect(analyzeConversation).not.toHaveBeenCalled()
    })

    it('rejects text entries with 400', async () => {
        const entry = await Bitacora.create({
            discordUserId: 'u-1', type: 'text', content: 'a note',
            adminId: 'a-1', adminUsername: 'bernardo',
        })
        routeTo(String(entry._id))

        await expect(analyzeHandler({})).rejects.toMatchObject({ statusCode: 400 })
    })

    it('returns 404 when the entry belongs to a different discord user', async () => {
        const entry = await seedImageEntry()
        routeTo(String(entry._id), 'someone-else')

        await expect(analyzeHandler({})).rejects.toMatchObject({ statusCode: 404 })
    })

    it('rejects unauthenticated requests with 401', async () => {
        const entry = await seedImageEntry()
        getUserSession.mockResolvedValue(null)
        routeTo(String(entry._id))

        await expect(analyzeHandler({})).rejects.toMatchObject({ statusCode: 401 })
    })
})
