import { DashBoardLog } from "#server/models/dashboardLog.schema";
import mongoose from "mongoose";

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { meetingId, name, startTime, discordUser } = body

    if (!meetingId || !startTime) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Missing required fields: meetingId, startTime',
        })
    }

    const session = await mongoose.startSession()

    try {
        session.startTransaction()

        // Find or create the ZoomLog
        let log = await ZoomLog.findOne({ meetingId }).session(session)

        if (!log) {
            //@ts-ignore
            [log] = await ZoomLog.create([{
                meetingId,
                name,
                occurredAt: new Date(Number(startTime) * 1000),
                participants: [],
            }], { session })
        }

        if (discordUser) {
            const { id: userId, username, roles } = discordUser

            if (!log.participants.includes(userId)) {
                log.participants.push(userId)
                await log.save({ session })
            }

            let user = await DiscordUser.findById(userId).session(session)

            if (!user) {
                await DiscordUser.create([{
                    _id: userId,
                    username,
                    roles: roles || [],
                    previousUsernames: [],
                }], { session })
            } else {
                const updates: any = {}

                if (user.username !== username) {
                    updates.$push = { previousUsernames: user.username }
                    updates.$set = { username }
                }

                if (roles) {
                    updates.$set = { ...updates.$set, roles }
                }

                if (Object.keys(updates).length > 0) {
                    await DiscordUser.findByIdAndUpdate(userId, updates, { session })
                }
            }

            //@ts-ignore
            await DashBoardLog.create([{
                userId,
                occurredAt: new Date(),
                logType: ['zoom-register'],
                meetingId,
            }], { session })
        }

        await session.commitTransaction()
        console.log('Transaction committed')
        return { success: true, log }

    } catch (error) {
        await session.abortTransaction()
        throw createError({
            status: 500,
            statusText: 'Transaction failed',
        })
    } finally {
        await session.endSession()
    }
})
