export default defineEventHandler(async (event) => {
    // Verify the shared secret sent by the bot
    const secret = getHeader(event, 'x-bot-secret')
    if (!secret || secret !== process.env.NUXT_BOT_SECRET) {
        throw createError({ status: 401, statusText: 'Unauthorized' })
    }

    const payload = await readBody(event)

    try {
        const bulkOperations = payload.map((user: any) => ({
            updateOne: {
                filter: { _id: user.id },
                update: { $set: user },
                upsert: true,
            },
        }))
        const result = await DiscordUser.bulkWrite(bulkOperations)
        return {
            success: true,
            message: 'Users created successfully',
            stats: {
                insertedCount: result.insertedCount,
                updatedCount: result.modifiedCount,
            },
        }
    } catch (e: any) {
        throw createError({ status: 500, statusText: e.message })
    }
})
