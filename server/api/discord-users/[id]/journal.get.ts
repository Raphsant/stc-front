import { createDownloadUrl } from '../../../utils/s3'
import { journalImageKeys } from '#shared/journal'

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Missing user id' })
    }

    const entries = await Bitacora.find({ discordUserId: id })
        .sort({ createdAt: -1 })
        .lean()

    return Promise.all(entries.map(async (e: any) => {
        if (e.type === 'image') {
            // One URL per screenshot, in conversation order; null where signing fails.
            e.imageUrls = await Promise.all(
                journalImageKeys(e).map(key => createDownloadUrl(key).catch(() => null)),
            )
            e.imageUrl = e.imageUrls[0] ?? null
        }
        return e
    }))
})
