export default defineEventHandler(async (event) => {
    try {
        const { from, to, q, status, sortBy, sortDir } = getQuery(event)

        // Runs BEFORE the expensive $lookups — cuts down the working set
        const preMatch: any = {}
        if (q) preMatch.username = { $regex: q, $options: 'i' }
        if (status === 'active') preMatch.removedAt = { $exists: false }
        if (status === 'removed') preMatch.removedAt = { $exists: true }

        const hasMeetingFilter = !!(from || to)
        const filteredMeetings: any = hasMeetingFilter
            ? {
                $filter: {
                    input: '$meetings',
                    as: 'meeting',
                    cond: {
                        $and: [
                            ...(from ? [{ $gte: ['$$meeting.occurredAt', new Date(from as string)] }] : []),
                            ...(to ? [{
                                $lte: ['$$meeting.occurredAt', (() => {
                                    const d = new Date(to as string)
                                    d.setHours(23, 59, 59, 999)
                                    return d
                                })()]
                            }] : [])
                        ]
                    }
                }
            }
            : '$meetings'

        const now = new Date()
        const last30From = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() - 29
        ))

        const sortFieldMap: Record<string, string> = {
            recent: 'recentActivity',
            meetings: 'meetingCount',
            messages30d: 'messages30d',
            lifetime: 'messageCount',
            joinedAt: 'joinedAt',
        }
        const sortField = sortFieldMap[sortBy as string] ?? 'meetingCount'
        const sortOrder = sortDir === 'asc' ? 1 : -1

        return await DiscordUser.aggregate([
            ...(Object.keys(preMatch).length ? [{ $match: preMatch }] : []),
            {
                $lookup: {
                    from: 'zoomLogs',
                    localField: '_id',
                    foreignField: 'participants',
                    as: 'meetings'
                }
            },
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
                                messages30d: {
                                    $sum: {
                                        $cond: [{ $gte: ['$date', last30From] }, '$count', 0]
                                    }
                                }
                            }
                        }
                    ],
                    as: 'activity'
                }
            },
            {
                $lookup: {
                    from: 'bitacoras',
                    let: { userId: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$discordUserId', '$$userId'] } } },
                        { $sort: { createdAt: 1 } },
                        {
                            $group: {
                                _id: '$discordUserId',
                                contactedBy: { $addToSet: '$adminUsername' },
                            }
                        }
                    ],
                    as: 'journal'
                }
            },
            {
                $project: {
                    _id: 1,
                    username: 1,
                    avatarUrl: 1,
                    roles: 1,
                    previousUsernames: 1,
                    messageCount: 1,
                    joinedAt: 1,
                    removedAt: 1,
                    meetingCount: { $size: filteredMeetings },
                    lastMeeting: { $max: '$meetings.occurredAt' },
                    lastMeetingAt: { $max: '$meetings.occurredAt' },
                    messages30d: { $ifNull: [{ $arrayElemAt: ['$activity.messages30d', 0] }, 0] },
                    lastMessageAt: { $arrayElemAt: ['$activity.lastMessageAt', 0] },
                    contactedBy: { $ifNull: [{ $arrayElemAt: ['$journal.contactedBy', 0] }, []] },
                    // Computed for the 'recent' sort — max of last message and last meeting
                    recentActivity: {
                        $max: [
                            { $ifNull: [{ $max: '$meetings.occurredAt' }, new Date(0)] },
                            { $ifNull: [{ $arrayElemAt: ['$activity.lastMessageAt', 0] }, new Date(0)] }
                        ]
                    }
                }
            },
            { $sort: { [sortField]: sortOrder, username: 1 } }
        ])
    } catch (e) {
        console.error(e)
        throw createError({ status: 500, statusText: 'Error fetching Discord users' })
    }
})
