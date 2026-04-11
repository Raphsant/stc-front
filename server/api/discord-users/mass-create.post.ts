export default defineEventHandler(async (event) => {
    const payload = await readBody(event)
    console.log(payload)
    try {
        const bulkOperations = payload.map((user: any) => ({
            updateOne: {
                filter: {_id: user.id},
                update: {$set: user},
                upsert: true
            }
        }))
        const result = await DiscordUser.bulkWrite(bulkOperations)
        return {
            success: true,
            message: 'Users created successfully',
            stats: {
                insertedCount: result.insertedCount,
                updatedCount: result.modifiedCount,
            }
        }
    } catch (e: any) {
        throw createError({
            status: 500,
            statusText: e.message,
        })
    }
})
