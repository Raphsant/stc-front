import mongoose from 'mongoose'

// Changes a staff account's role. Superadmin only. The change reaches that
// person's session on their next request (server/utils/staffSession.ts).
export default defineEventHandler(async (event) => {
    await requireSuperAdmin(event)
    const id = getRouterParam(event, 'id')
    if (!id || !mongoose.isValidObjectId(id)) {
        throw createError({ statusCode: 404, statusMessage: 'No existe esa cuenta' })
    }
    const { role } = (await readBody(event)) ?? {}
    if (!isStaffRole(role)) {
        throw createError({ statusCode: 400, statusMessage: 'Rol no válido' })
    }
    return { user: await setStaffRole(id, role) }
})
