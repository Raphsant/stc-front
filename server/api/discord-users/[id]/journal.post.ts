import { isBitacoraKey } from '../../../utils/s3'
import { DashBoardLog } from '../../../models/dashboardLog.schema'
import { MAX_JOURNAL_IMAGES } from '#shared/journal'

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
    if (type !== 'text' && type !== 'image') {
        throw createError({ statusCode: 400, statusMessage: 'Invalid entry type' })
    }

    // An image entry carries one or more screenshots of the same conversation
    // (`images`, in order). A bare `content` key is still accepted as a
    // single-image entry.
    let images: string[] = []
    let content = typeof body?.content === 'string' ? body.content.trim() : ''

    if (type === 'image') {
        const raw: unknown[] = Array.isArray(body?.images) ? body.images : (content ? [content] : [])
        if (!raw.length) {
            throw createError({ statusCode: 400, statusMessage: 'At least one image is required' })
        }
        if (raw.length > MAX_JOURNAL_IMAGES) {
            throw createError({ statusCode: 400, statusMessage: `Máximo ${MAX_JOURNAL_IMAGES} imágenes por entrada` })
        }
        if (!raw.every(key => isBitacoraKey(key as string, id)) || new Set(raw).size !== raw.length) {
            throw createError({ statusCode: 400, statusMessage: 'Invalid image key' })
        }
        images = raw as string[]
        content = images[0]!
    } else if (!content) {
        throw createError({ statusCode: 400, statusMessage: 'Content is required' })
    }

    const target = await DiscordUser.findById(id).lean()
    if (!target) {
        throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    const entry = await Bitacora.create({
        discordUserId: id,
        type,
        content,
        images,
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
