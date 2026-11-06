// Total active Discord members — used by the Usuarios page count pill.
export default defineEventHandler(async () => {
    try {
        const count = await DiscordUser.countDocuments({ removedAt: null })
        return { count }
    } catch (e: any) {
        throw createError({ status: 500, statusText: e.message })
    }
})
