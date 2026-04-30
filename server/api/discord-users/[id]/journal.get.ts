import { createDownloadUrl } from '../../../utils/s3'

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Missing user id' })
    }

    const entries = await Bitacora.find({ discordUserId: id })
        .sort({ createdAt: -1 })
        .lean()

    return Promise.all(entries.map(async (e: any) => {
        if (e.type === 'image' && e.content) {
            try {
                e.imageUrl = await createDownloadUrl(e.content)
            } catch {
                e.imageUrl = null
            }
        }
        return e
    }))
})
