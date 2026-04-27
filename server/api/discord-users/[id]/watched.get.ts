export default defineEventHandler(async (event) => {
    const userId = getRouterParam(event, 'id')

    const [recent, total] = await Promise.all([
        VideoProgress.find({ userId })
            .sort({ updatedAt: -1 })
            .limit(5)
            .lean(),
        VideoProgress.countDocuments({ userId }),
    ])

    return { recent, total }
})
