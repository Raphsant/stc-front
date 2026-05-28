export default defineEventHandler(async (event) => {
    const entryId = getRouterParam(event, 'entryId')
    const { user } = await getUserSession(event)

    const entry = await Bitacora.findById(entryId)
    if (!entry) throw createError({ statusCode: 404, statusMessage: 'Entry not found' })

    if ((entry as any).markedForDeletion) {
        // Superadmins can unmark anything; regular admins only their own marks
        const canUnmark =
            isSuperAdmin(user) ||
            (entry as any).markedForDeletionBy === (user as any).username

        if (!canUnmark) throw createError({ statusCode: 403, statusMessage: 'No puedes desmarcar esta entrada' })

        ;(entry as any).markedForDeletion = false
        ;(entry as any).markedForDeletionAt = null
        ;(entry as any).markedForDeletionBy = null
    } else {
        ;(entry as any).markedForDeletion = true
        ;(entry as any).markedForDeletionAt = new Date()
        ;(entry as any).markedForDeletionBy = (user as any).username
    }

    await entry.save()
    return entry.toObject()
})
