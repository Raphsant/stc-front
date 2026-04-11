export default defineEventHandler(async (event) => {
    try {
        const query = getQuery(event)
        const page = parseInt(query.page as string) || 1
        const limit = parseInt(query.limit as string) || 10
        const search = query.q as string
        const role = query.role as string
        const skip = (page - 1) * limit

        const matchStage: any = {}
        if (search && search !== 'null' && search !== 'undefined') {
            matchStage.username = { $regex: search, $options: 'i' }
        }
        if (role && role !== 'null' && role !== 'undefined') {
            matchStage.roles = { $in: [new RegExp(role, 'i')] }
        }

        const [results] = await DiscordUser.aggregate([
            { $match: matchStage },
            {
                $facet: {
                    total: [{ $count: 'count' }],
                    data: [
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
                                meetingCount: { $size: '$meetings' }
                            }
                        },
                        { $sort: { meetingCount: -1 } },
                        { $skip: skip },
                        { $limit: limit }
                    ]
                }
            }
        ])

        return {
            users: results.data,
            total: results.total[0]?.count || 0
        }
    } catch (e) {
        console.error(e)
        throw createError({
            status: 500,
            statusText: 'Error fetching Discord users',
        })
    }
})



