export default defineEventHandler(async (event) => {
    try {
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
                   meetingCount: { $size: '$meetings' },
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
