// Returns cumulative meeting count snapshots for the last 12 days +
// count of meetings in the last 7 days. Used by the dashboard
// Meetings Registrados tile.

export default defineEventHandler(async () => {
    const days = 12
    const now = new Date()

    const dates: Date[] = []
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        d.setHours(23, 59, 59, 999)
        dates.push(d)
    }

    try {
        const series = await Promise.all(
            dates.map(date => ZoomLog.countDocuments({ occurredAt: { $lte: date } }))
        )

        const total = series[series.length - 1] ?? 0

        const sevenAgo = new Date(now)
        sevenAgo.setDate(sevenAgo.getDate() - 7)
        sevenAgo.setHours(0, 0, 0, 0)
        const delta = await ZoomLog.countDocuments({ occurredAt: { $gte: sevenAgo } })

        return { total, delta, series }
    } catch (e: any) {
        throw createError({ status: 500, statusText: e.message })
    }
})
