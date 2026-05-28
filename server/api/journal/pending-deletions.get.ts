import { Bitacora } from '../../models/Bitacora.schema'
import { DiscordUser } from '../../models/DiscordUser.schema'

export default defineEventHandler(async (event) => {
    await requireSuperAdmin(event)

    const entries = await Bitacora.find({ markedForDeletion: true })
        .sort({ markedForDeletionAt: -1 })
        .lean()

    const userIds = [...new Set(entries.map((e: any) => e.discordUserId))]
    const users = await DiscordUser.find({ _id: { $in: userIds } }).lean()
    const userMap = Object.fromEntries(users.map((u: any) => [String(u._id), u]))

    return entries.map((e: any) => ({
        ...e,
        discordUser: userMap[e.discordUserId] ?? null,
    }))
})
