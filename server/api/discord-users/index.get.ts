export default defineEventHandler(async (event) => {
    try {
        const { from, to } = getQuery(event)

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

        return await DiscordUser.aggregate([
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
                $project: {
                    _id: 1,
                    username: 1,
                    roles: 1,
                    previousUsernames: 1,
                    messageCount: 1,
                    meetingCount: { $size: filteredMeetings },
                    lastMeeting: { $max: '$meetings.occurredAt' },
                    lastMeetingAt: { $max: '$meetings.occurredAt' },
                    messages30d: { $ifNull: [{ $arrayElemAt: ['$activity.messages30d', 0] }, 0] },
                    lastMessageAt: { $arrayElemAt: ['$activity.lastMessageAt', 0] }
                }
            },
            { $sort: { meetingCount: -1, username: 1 } }
        ])
    } catch (e) {
        console.error(e)
        throw createError({
            status: 500,
            statusText: 'Error fetching Discord users',
        })
    }
})
