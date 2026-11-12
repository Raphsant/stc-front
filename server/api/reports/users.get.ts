import {
    applyFilters,
    parseFilters,
    sortRows,
    summarize,
    toRow,
    type ReportResponse,
} from '#shared/reports'

function escapeRegex(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// GET /api/reports/users — every user matching the report filters, plus the
// summary the Reportes page and its exports are built from. Stored fields are
// matched in Mongo before the $lookups; tier, engagement and expiry are
// derived per row in shared/reports.ts and filtered there.
export default defineEventHandler(async (event): Promise<ReportResponse> => {
    try {
        const f = parseFilters(getQuery(event) as Record<string, unknown>)
        const now = new Date()

        const memberMatch: any = {}
        // removedAt defaults to null and is reset on rejoin; null also matches a missing field
        if (f.member === 'active') memberMatch.removedAt = null
        if (f.member === 'removed') memberMatch.removedAt = { $ne: null }

        const preMatch: any = { ...memberMatch }
        if (f.q) preMatch.username = { $regex: escapeRegex(f.q), $options: 'i' }
        if (f.country === 'none') preMatch['cfLocation.country'] = null
        else if (f.country) {
            preMatch['cfLocation.country'] = f.country
            if (f.region) preMatch['cfLocation.regionKey'] = f.region === 'none' ? null : f.region
            if (f.city) preMatch['cfLocation.cityKey'] = f.city
        }
        if (f.joinedFrom || f.joinedTo) {
            preMatch.joinedAt = {
                ...(f.joinedFrom ? { $gte: new Date(f.joinedFrom) } : {}),
                ...(f.joinedTo ? { $lte: new Date(`${f.joinedTo}T23:59:59.999Z`) } : {}),
            }
        }
        if (f.cf === 'linked') preMatch.cfContactId = { $ne: null }
        if (f.cf === 'unlinked') preMatch.cfContactId = null

        const last30From = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29))

        const [docs, universe, lastSync] = await Promise.all([
            DiscordUser.aggregate([
                ...(Object.keys(preMatch).length ? [{ $match: preMatch }] : []),
                // Same activity lookups as /api/discord-users
                { $lookup: { from: 'zoomLogs', localField: '_id', foreignField: 'participants', as: 'meetings' } },
                {
                    $lookup: {
                        from: 'messageActivity',
                        let: { userId: '$_id' },
                        pipeline: [
                            { $match: { $expr: { $eq: ['$userId', '$$userId'] } } },
                            {
                                $group: {
                                    _id: '$userId',
                                    lastMessageAt: { $max: '$lastMessageAt' },
                                    messages30d: { $sum: { $cond: [{ $gte: ['$date', last30From] }, '$count', 0] } },
                                },
                            },
                        ],
                        as: 'activity',
                    },
                },
                {
                    $lookup: {
                        from: 'bitacoras',
                        let: { userId: '$_id' },
                        pipeline: [
                            { $match: { $expr: { $eq: ['$discordUserId', '$$userId'] } } },
                            { $group: { _id: '$discordUserId', contactedBy: { $addToSet: '$adminUsername' } } },
                        ],
                        as: 'journal',
                    },
                },
                // Alpha memberships are written by stc-payments (same database, _id = Discord id)
                {
                    $lookup: {
                        from: 'memberships',
                        localField: '_id',
                        foreignField: '_id',
                        pipeline: [{ $project: { status: 1, expiresAt: 1 } }],
                        as: 'alpha',
                    },
                },
                {
                    $project: {
                        username: 1,
                        avatarUrl: 1,
                        roles: 1,
                        messageCount: 1,
                        joinedAt: 1,
                        removedAt: 1,
                        cfContactId: 1,
                        cfLocation: 1,
                        cfMembership: 1,
                        alpha: 1,
                        meetingCount: { $size: '$meetings' },
                        lastMeetingAt: { $max: '$meetings.occurredAt' },
                        messages30d: { $ifNull: [{ $arrayElemAt: ['$activity.messages30d', 0] }, 0] },
                        lastMessageAt: { $arrayElemAt: ['$activity.lastMessageAt', 0] },
                        contactedBy: { $ifNull: [{ $arrayElemAt: ['$journal.contactedBy', 0] }, []] },
                    },
                },
            ]),
            DiscordUser.countDocuments(memberMatch),
            DiscordUser.findOne({ 'cfMembership.syncedAt': { $ne: null } })
                .sort({ 'cfMembership.syncedAt': -1 })
                .select('cfMembership.syncedAt')
                .lean(),
        ])

        const t = now.getTime()
        const rows = sortRows(applyFilters(docs.map((d: any) => toRow(d, t)), f, t), f.sortBy, f.sortDir)
        const syncedAt = (lastSync as any)?.cfMembership?.syncedAt

        return {
            generatedAt: now.toISOString(),
            filters: f,
            total: rows.length,
            universe,
            rows,
            summary: summarize(rows, f, syncedAt ? new Date(syncedAt).toISOString() : null),
        }
    } catch (e) {
        console.error(e)
        throw createError({ status: 500, statusText: 'Error generating report' })
    }
})
