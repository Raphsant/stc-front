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
                $project: {
                    _id: 1,
                    username: 1,
                    roles: 1,
                    previousUsernames: 1,
                    messageCount: 1,
                    meetingCount: { $size: filteredMeetings },
                    lastMeeting: { $max: '$meetings.occurredAt' }
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
