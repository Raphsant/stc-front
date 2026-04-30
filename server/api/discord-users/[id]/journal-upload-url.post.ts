import { randomUUID } from 'node:crypto'
import {
    ALLOWED_IMAGE_MIME,
    MAX_IMAGE_BYTES,
    BITACORA_PREFIX,
    createUploadUrl,
    extForMime,
} from '../../../utils/s3'

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
    const contentType = typeof body?.contentType === 'string' ? body.contentType : ''
    const size = Number(body?.size)

    if (!ALLOWED_IMAGE_MIME.has(contentType)) {
        throw createError({ statusCode: 400, statusMessage: 'Unsupported image type' })
    }
    if (!Number.isFinite(size) || size <= 0) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid file size' })
    }
    if (size > MAX_IMAGE_BYTES) {
        throw createError({ statusCode: 413, statusMessage: 'File too large (max 5MB)' })
    }

    const target = await DiscordUser.findById(id).lean()
    if (!target) {
        throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    const key = `${BITACORA_PREFIX}${id}/${randomUUID()}.${extForMime(contentType)}`
    const uploadUrl = await createUploadUrl(key, contentType)

    return { uploadUrl, key }
})
