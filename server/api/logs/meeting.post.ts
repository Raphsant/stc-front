export default defineEventHandler(async (event) => {

    const body = await readBody(event)
    const {meetingId, name, startTime, discordUser} = body
    console.log(name)

    if (!meetingId || !startTime) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Missing required fields: meetingId, startTime',
        })
    }

    // Find or create the ZoomLog
    let log = await ZoomLog.findOne({meetingId})

    if (!log) {
        log = await ZoomLog.create({
            meetingId,
            name,
            //@ts-ignore
            occurredAt: new Date(Number(startTime) * 1000),
            participants: [],
        })
    }

    if (discordUser) {
        const {id: userId, username, roles} = discordUser

        // Add to participants if not already present
        if (!log.participants.includes(userId)) {
            log.participants.push(userId)
            await log.save()
        }

        // Discord User check/update
        let user = await DiscordUser.findById(userId)

        if (!user) {
            await DiscordUser.create({
                _id: userId,
                username,
                roles: roles || [],
                previousUsernames: [],
            })
        } else {
            const updates: any = {}

            // Update username if it changed
            if (user.username !== username) {
                updates.$push = {previousUsernames: user.username}
                updates.$set = {username}
            }

            // Update roles if provided
            if (roles) {
                updates.$set = {...updates.$set, roles}
            }

            if (Object.keys(updates).length > 0) {
                await DiscordUser.findByIdAndUpdate(userId, updates)
            }
        }
    }

    return {success: true, log}
})
