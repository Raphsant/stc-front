import { Bitacora } from '../../models/Bitacora.schema'
import { DiscordUser } from '../../models/DiscordUser.schema'
import { PRIORITY_RANK, type Priority } from '#shared/deltaAnalysis'

// The follow-up queue: every analyzed conversation that still needs an agent to
// act, ordered the way the team should work it — highest priority first, then
// soonest recontact date.
export default defineEventHandler(async (event) => {
    const session = await getUserSession(event)
    if (!session?.user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const { status } = getQuery(event) as { status?: string }
    const filter: Record<string, any> = status === 'all'
        ? { followUpStatus: { $ne: null } }
        : { followUpStatus: status === 'done' ? 'done' : 'pending' }

    const entries = await Bitacora.find(filter).lean()

    const userIds = [...new Set(entries.map((e: any) => e.discordUserId))]
    const users = await DiscordUser.find({ _id: { $in: userIds } }).lean()
    const userMap = Object.fromEntries(users.map((u: any) => [String(u._id), u]))

    // Sorted in JS rather than in the aggregation: the priority order is a
    // ranking, not a lexical sort, and the set is small (manually analyzed
    // screenshots). Entries with no recontact date sort last.
    const rank = (p: unknown) => PRIORITY_RANK[p as Priority] ?? PRIORITY_RANK.medium
    const when = (d: unknown) => (d ? new Date(d as string).getTime() : Number.POSITIVE_INFINITY)

    const sorted = entries.sort((a: any, b: any) => {
        const byPriority = rank(a.followUpPriority) - rank(b.followUpPriority)
        if (byPriority !== 0) return byPriority
        return when(a.recontactDate) - when(b.recontactDate)
    })

    return sorted.map((e: any) => ({
        ...e,
        discordUser: userMap[e.discordUserId] ?? null,
    }))
})
