import { DashBoardLog } from "#server/models/dashboardLog.schema";

export default defineEventHandler(async (event) => {
    const { period = 'daily', from, to } = getQuery(event)

    const now = new Date()
    let startDate: Date
    let endDate: Date
    let groupFormat: string

    if (period === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1)
        groupFormat = '%Y-%m'
    } else if (period === 'weekly') {
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 7 * 11)
        startDate.setHours(0, 0, 0, 0)
        groupFormat = '%G-%V'
    } else {
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 29)
        startDate.setHours(0, 0, 0, 0)
        groupFormat = '%Y-%m-%d'
    }

    // Custom date range overrides the default window
    if (from) startDate = new Date(from as string)
    if (to) {
        endDate = new Date(to as string)
        endDate.setHours(23, 59, 59, 999)
    } else {
        endDate = now
    }

    try {
        const results = await DashBoardLog.aggregate([
            {
                $match: {
                    occurredAt: { $gte: startDate, $lte: endDate },
                    logType: { $in: ['zoom-register'] }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: groupFormat, date: '$occurredAt' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ])

        return results.map(r => ({ date: r._id, count: r.count }))
    } catch (e) {
        console.error(e)
        throw createError({ status: 500, statusText: 'Error fetching stats' })
    }
})
