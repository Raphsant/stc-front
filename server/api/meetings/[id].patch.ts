export default defineEventHandler(async (event) => {
    const id   = event.context.params?.id
    const body = await readBody(event)
    const { action, userId } = body

    if (!action || !['remove', 'clear'].includes(action)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Missing or invalid action. Use "remove" or "clear".',
        })
    }

    if (action === 'remove' && !userId) {
        throw createError({
            statusCode: 400,
            statusMessage: 'userId is required for action "remove".',
        })
    }

    try {
        const meeting = await ZoomLog.findById(id)

        if (!meeting) {
            throw createError({ statusCode: 404, statusMessage: 'Meeting not found' })
        }

        if (action === 'remove') {
            //@ts-ignore
            meeting.participants = meeting.participants.filter(
                (p: any) => p.toString() !== userId
            )
        } else {
            //@ts-ignore
            meeting.participants = []
        }

        await meeting.save()
        return await ZoomLog.findById(id).populate('participants')

    } catch (error: any) {
        throw createError({
            statusCode: error.statusCode ?? 500,
            statusMessage: error.statusMessage ?? error.message,
        })
    }
})
