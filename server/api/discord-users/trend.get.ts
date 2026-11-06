// Returns active-member count snapshots for the last 12 days + percent
// change vs. seven days ago. Used by the dashboard Miembros Totales tile.

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
        // Active members as of each date: joined on or before AND
        // (never removed OR removed after that date)
        const series = await Promise.all(
            dates.map(date =>
                DiscordUser.countDocuments({
                    joinedAt: { $lte: date },
                    $or: [{ removedAt: null }, { removedAt: { $gt: date } }],
                })
            )
        )

        const total = series[series.length - 1] ?? 0
        const prevIdx = Math.max(0, series.length - 8) // 7 days back
        const prev = series[prevIdx] ?? total
        const deltaPct = prev > 0 ? ((total - prev) / prev) * 100 : 0

        return {
            total,
            deltaPct: Math.round(deltaPct * 10) / 10,
            series,
        }
    } catch (e: any) {
        throw createError({ status: 500, statusText: e.message })
    }
})
