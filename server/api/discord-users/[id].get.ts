export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    try {
        const user = await DiscordUser.aggregate([
            { $match: { _id: id } },
            {
                $lookup: {
                    from: 'zoomLogs',
                    localField: '_id',
                    foreignField: 'participants',
                    as: 'meetings'
                }
            },
            {
                $addFields: {
                    meetingCount: { $size: '$meetings' }
                }
            },
            {
                $project: {
                    meetings: 0
                }
            }
        ])

        if (!user.length) {
            throw createError({
                statusCode: 404,
                statusMessage: 'User not found'
            })
        }

        return user[0]
    } catch (e: any) {
        throw createError({
            statusCode: e.statusCode || 500,
            statusMessage: e.statusMessage || 'Error fetching user'
        })
    }
})
