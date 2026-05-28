import { isBitacoraKey } from '../../../utils/s3'
import { DashBoardLog } from '../../../models/dashboardLog.schema'

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Missing user id' })
    }

    const session = await getUserSession(event)
    if (!session?.user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const body = await readBody(event)
    const type = body?.type
    const content = typeof body?.content === 'string' ? body.content.trim() : ''

    if (type !== 'text' && type !== 'image') {
        throw createError({ statusCode: 400, statusMessage: 'Invalid entry type' })
    }
    if (!content) {
        throw createError({ statusCode: 400, statusMessage: 'Content is required' })
    }
    if (type === 'image' && !isBitacoraKey(content, id)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid image key' })
    }

    const target = await DiscordUser.findById(id).lean()
    if (!target) {
        throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    const entry = await Bitacora.create({
        discordUserId: id,
        type,
        content,
        adminId: String((session.user as any).id),
        adminUsername: (session.user as any).username,
    })

    await DashBoardLog.create({
        userId: id,
        adminUsername: (session.user as any).username,
        logType: ['journal-entry'],
        occurredAt: new Date(),
    })

    return entry.toObject()
})
