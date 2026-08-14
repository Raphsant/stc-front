import { Bitacora } from '../../../models/Bitacora.schema'
import { FOLLOW_UP_STATUSES, type FollowUpStatus } from '#shared/deltaAnalysis'

// Team workflow toggle for a follow-up: mark it handled, or reopen it.
// Lives under /api/journal/ because the discord-users route already uses
// [entryId].patch.ts for the deletion-mark toggle.
export default defineEventHandler(async (event) => {
    const entryId = getRouterParam(event, 'entryId')

    const session = await getUserSession(event)
    if (!session?.user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const body = await readBody(event) as { status?: string }
    const status = body?.status
    if (!status || !(FOLLOW_UP_STATUSES as readonly string[]).includes(status)) {
        throw createError({ statusCode: 400, statusMessage: 'status debe ser "pending" o "done"' })
    }

    const entry = await Bitacora.findById(entryId)
    // A null followUpStatus means the entry was never analyzed (or needs no
    // action), so there is no follow-up to move.
    if (!entry || (entry as any).followUpStatus == null) {
        throw createError({ statusCode: 404, statusMessage: 'Seguimiento no encontrado' })
    }

    const done = status as FollowUpStatus === 'done'
    ;(entry as any).followUpStatus = status
    ;(entry as any).followUpDoneAt = done ? new Date() : null
    ;(entry as any).followUpDoneBy = done ? (session.user as any).username ?? null : null
    await entry.save()

    return entry.toObject()
})
