import { DashBoardLog } from '../../../../models/dashboardLog.schema'

export default defineEventHandler(async (event) => {
    const entryId = getRouterParam(event, 'entryId')
    const admin = await requireSuperAdmin(event)

    const entry = await Bitacora.findById(entryId)
    if (!entry) throw createError({ statusCode: 404, statusMessage: 'Entry not found' })

    await DashBoardLog.create({
        userId: (entry as any).discordUserId,
        adminUsername: (admin as any).username,
        logType: ['journal-delete'],
        occurredAt: new Date(),
    })

    await entry.deleteOne()
    return { success: true }
})
