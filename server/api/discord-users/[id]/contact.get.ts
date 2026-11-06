import { CfNotFoundError, getCfContactDetails } from '../../../utils/clickfunnels'

// ClickFunnels contact details (name, email, phone, address) for a Discord
// user, looked up through DiscordUser.cfContactId (set by stcbot).
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Missing user id' })
    }

    const user = await DiscordUser.findById(id, { cfContactId: 1 }).lean()
    if (!user) {
        throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    if (user.cfContactId == null) return { linked: false }

    try {
        return { linked: true, ...(await getCfContactDetails(user.cfContactId)) }
    } catch (e: any) {
        if (e instanceof CfNotFoundError) {
            return { linked: true, contactId: user.cfContactId, missing: true }
        }
        console.error(e)
        throw createError({ statusCode: 502, statusMessage: 'Error fetching ClickFunnels contact' })
    }
})
