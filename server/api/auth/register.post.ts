// Creates a staff account. With no accounts at all (first run) anyone may create
// the first one, and it is a superadmin so someone can manage the rest. After that
// only a superadmin may, with the role they choose (admin when none is given).
//
// This route is public in server/middleware/auth.ts so the first run can reach it;
// the checks below are the only ones it gets.

export default defineEventHandler(async (event) => {
    const body = (await readBody(event)) ?? {}

    const firstRun = (await User.countDocuments()) === 0
    if (firstRun) {
        const account = await createStaffAccount({ username: body.username, password: body.password }, 'superadmin')
        return { id: account.id, username: account.username, role: account.role }
    }

    await requireUserSession(event)
    // the role as stored now, not as it was at login
    const me = await syncStaffSession(event)
    if (!isSuperAdmin(me)) {
        throw createError({ statusCode: 403, statusMessage: 'Solo un superadmin puede crear cuentas' })
    }

    const account = await createStaffAccount(body)
    return { id: account.id, username: account.username, role: account.role }
})
