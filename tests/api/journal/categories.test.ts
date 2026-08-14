import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'

let getHandler: (event: any) => Promise<any>
let Bitacora: any

const getUserSession = vi.fn()
const ADMIN = { user: { id: 'a-1', username: 'bernardo' } }

async function seedAnalyzed(result: Record<string, any>, over: Record<string, any> = {}) {
    return Bitacora.create({
        discordUserId: 'u-1',
        type: 'image',
        content: 'bitacora/u-1/shot.png',
        adminId: 'a-1',
        adminUsername: 'bernardo',
        analysisStatus: 'done',
        analysisResult: {
            schema_version: '1.0',
            best_fit_category: 'cost_sensitivity',
            additional_categories: [],
            key_customer_quote: 'no me da el presupuesto',
            priority: 'medium',
            ...result,
        },
        ...over,
    })
}

function byCategory(rows: any[], category: string) {
    return rows.find(r => r.category === category)
}

beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!)

    //@ts-ignore
    ;({ Bitacora } = await import('#server/models/Bitacora.schema'))
    vi.stubGlobal('getUserSession', getUserSession)

    const mod = await import('#server/api/journal/categories.get')
    getHandler = mod.default as any
})

afterAll(async () => {
    await mongoose.disconnect()
})

beforeEach(async () => {
    await Promise.all(
        Object.values(mongoose.connection.collections).map(c => c.deleteMany({}))
    )
    getUserSession.mockReset()
    getUserSession.mockResolvedValue(ADMIN)
})

describe('GET /api/journal/categories', () => {
    it('counts a category from both the primary and the additional slots', async () => {
        await seedAnalyzed({ best_fit_category: 'cost_sensitivity' })
        await seedAnalyzed({
            best_fit_category: 'im_ok_no_need',
            additional_categories: ['cost_sensitivity'],
        })

        const { categories } = await getHandler({})

        const cost = byCategory(categories, 'cost_sensitivity')
        expect(cost.count).toBe(2)
        expect(cost.primaryCount).toBe(1)     // only one thread was *about* it
        expect(byCategory(categories, 'im_ok_no_need').count).toBe(1)
    })

    it('counts distinct customers per category', async () => {
        await seedAnalyzed({}, { discordUserId: 'u-1' })
        await seedAnalyzed({}, { discordUserId: 'u-1' })
        await seedAnalyzed({}, { discordUserId: 'u-2' })

        const { categories } = await getHandler({})

        const cost = byCategory(categories, 'cost_sensitivity')
        expect(cost.count).toBe(3)
        expect(cost.userCount).toBe(2)
    })

    it('excludes entries analyzed with the pre-Delta shape', async () => {
        await seedAnalyzed({})
        await Bitacora.create({
            discordUserId: 'u-9',
            type: 'image',
            content: 'bitacora/u-9/old.png',
            adminId: 'a-1',
            adminUsername: 'bernardo',
            analysisStatus: 'done',
            // legacy pain-point shape: no schema_version, no categories
            analysisResult: {
                summary: 'Cliente molesto con el precio',
                sentiment: 'negativo',
                painPoints: [{ category: 'precio', detail: 'caro', severity: 'alta' }],
            },
        })

        const { categories, analyzedCount } = await getHandler({})

        expect(analyzedCount).toBe(1)
        expect(categories).toHaveLength(1)
        expect(categories[0].category).toBe('cost_sensitivity')
    })

    it('ignores entries that are not done', async () => {
        await seedAnalyzed({})
        await seedAnalyzed({}, { analysisStatus: 'error' })
        await seedAnalyzed({}, { analysisStatus: 'pending' })

        const { analyzedCount } = await getHandler({})
        expect(analyzedCount).toBe(1)
    })

    it('returns at most 5 examples, newest first', async () => {
        for (let i = 1; i <= 7; i++) {
            await seedAnalyzed(
                { key_customer_quote: `quote-${i}` },
                { createdAt: new Date(`2026-01-0${i}`) },
            )
        }

        const { categories } = await getHandler({})
        const cost = byCategory(categories, 'cost_sensitivity')

        expect(cost.count).toBe(7)
        expect(cost.examples).toHaveLength(5)
        expect(cost.examples[0].quote).toBe('quote-7')
        expect(cost.examples[4].quote).toBe('quote-3')
    })

    it('sorts categories by frequency', async () => {
        await seedAnalyzed({ best_fit_category: 'im_ok_no_need' })
        await seedAnalyzed({ best_fit_category: 'cost_sensitivity' })
        await seedAnalyzed({ best_fit_category: 'cost_sensitivity' })

        const { categories } = await getHandler({})
        expect(categories[0].category).toBe('cost_sensitivity')
        expect(categories[0].count).toBe(2)
    })

    it('rejects unauthenticated requests with 401', async () => {
        getUserSession.mockResolvedValue(null)
        await expect(getHandler({})).rejects.toMatchObject({ statusCode: 401 })
    })
})
