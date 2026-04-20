export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')

    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Missing user id' })
    }

    try {
        const now = new Date()
        const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
        const day = 24 * 60 * 60 * 1000

        const last7From = new Date(todayUtc.getTime() - 6 * day)
        const last30From = new Date(todayUtc.getTime() - 29 * day)
        const prev30From = new Date(todayUtc.getTime() - 59 * day)
        const prev30To = new Date(todayUtc.getTime() - 30 * day)
        const daily90From = new Date(todayUtc.getTime() - 89 * day)

        const [dailyAgg, byChannelAgg, totalsAgg, lifetimeAgg, lastMessageAgg] = await Promise.all([
            MessageActivity.aggregate([
                { $match: { userId: id, date: { $gte: daily90From } } },
                { $group: { _id: '$date', count: { $sum: '$count' } } },
                { $sort: { _id: 1 } },
            ]),
            MessageActivity.aggregate([
                { $match: { userId: id, date: { $gte: last30From } } },
                {
                    $group: {
                        _id: '$channelId',
                        channelName: { $last: '$channelName' },
                        count: { $sum: '$count' },
                    },
                },
                { $sort: { count: -1 } },
            ]),
            MessageActivity.aggregate([
                { $match: { userId: id, date: { $gte: prev30From } } },
                {
                    $group: {
                        _id: null,
                        last7: {
                            $sum: { $cond: [{ $gte: ['$date', last7From] }, '$count', 0] },
                        },
                        last30: {
                            $sum: { $cond: [{ $gte: ['$date', last30From] }, '$count', 0] },
                        },
                        prev30: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $gte: ['$date', prev30From] },
                                            { $lt: ['$date', prev30To] },
                                        ],
                                    },
                                    '$count',
                                    0,
                                ],
                            },
                        },
                    },
                },
            ]),
            MessageActivity.aggregate([
                { $match: { userId: id } },
                { $group: { _id: null, lifetime: { $sum: '$count' } } },
            ]),
            MessageActivity.aggregate([
                { $match: { userId: id } },
                { $group: { _id: null, lastMessageAt: { $max: '$lastMessageAt' } } },
            ]),
        ])

        const dailyMap = new Map<string, number>()
        for (const row of dailyAgg) {
            const d = new Date(row._id)
            const key = d.toISOString().slice(0, 10)
            dailyMap.set(key, row.count)
        }

        const daily: { date: string; count: number }[] = []
        for (let i = 89; i >= 0; i--) {
            const d = new Date(todayUtc.getTime() - i * day)
            const key = d.toISOString().slice(0, 10)
            daily.push({ date: key, count: dailyMap.get(key) ?? 0 })
        }

        const byChannel = byChannelAgg.map((c: any) => ({
            channelId: c._id,
            channelName: c.channelName ?? null,
            count: c.count,
        }))

        const totals = {
            last7: totalsAgg[0]?.last7 ?? 0,
            last30: totalsAgg[0]?.last30 ?? 0,
            prev30: totalsAgg[0]?.prev30 ?? 0,
            lifetime: lifetimeAgg[0]?.lifetime ?? 0,
        }

        return {
            daily,
            byChannel,
            totals,
            lastMessageAt: lastMessageAgg[0]?.lastMessageAt ?? null,
        }
    } catch (e: any) {
        console.error(e)
        throw createError({
            statusCode: e.statusCode || 500,
            statusMessage: e.statusMessage || 'Error fetching activity',
        })
    }
})
