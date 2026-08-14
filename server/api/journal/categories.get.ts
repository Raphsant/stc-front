import { Bitacora } from '../../models/Bitacora.schema'
import { DELTA_SCHEMA_VERSION } from '#shared/deltaAnalysis'

// Global rollup of conversation categories across every analyzed screenshot.
// A thread counts once per distinct category it carries (primary + additional),
// so the totals answer "what are members actually telling us", while
// primaryCount answers "how often is this THE story of the conversation".
export default defineEventHandler(async (event) => {
    const session = await getUserSession(event)
    if (!session?.user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    // schema_version gates out entries analyzed before the Delta rewrite —
    // their old pain-point shape has no categories to roll up.
    const match = {
        analysisStatus: 'done',
        'analysisResult.schema_version': DELTA_SCHEMA_VERSION,
    }

    const categories = await Bitacora.aggregate([
        { $match: match },
        {
            $project: {
                discordUserId: 1,
                createdAt: 1,
                quote: '$analysisResult.key_customer_quote',
                priority: '$analysisResult.priority',
                primary: '$analysisResult.best_fit_category',
                cats: {
                    $setUnion: [
                        ['$analysisResult.best_fit_category'],
                        { $ifNull: ['$analysisResult.additional_categories', []] },
                    ],
                },
            },
        },
        { $unwind: '$cats' },
        {
            $group: {
                _id: '$cats',
                count: { $sum: 1 },
                users: { $addToSet: '$discordUserId' },
                primaryCount: {
                    $sum: { $cond: [{ $eq: ['$cats', '$primary'] }, 1, 0] },
                },
                examples: {
                    $push: {
                        quote: '$quote',
                        discordUserId: '$discordUserId',
                        createdAt: '$createdAt',
                        priority: '$priority',
                    },
                },
            },
        },
        {
            $project: {
                _id: 0,
                category: '$_id',
                count: 1,
                primaryCount: 1,
                userCount: { $size: '$users' },
                examples: {
                    $slice: [
                        { $sortArray: { input: '$examples', sortBy: { createdAt: -1 } } },
                        5,
                    ],
                },
            },
        },
        { $sort: { count: -1 } },
    ])

    const analyzedCount = await Bitacora.countDocuments(match)

    return { categories, analyzedCount }
})
