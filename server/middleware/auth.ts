
const PUBLIC_ROUTES = [
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/me',
    // Checks for itself: open only while there are no accounts, superadmin-only after.
    '/api/auth/register',
    '/api/discord-users/mass-create'
]


export default defineEventHandler(async (event) => {
    const path = getRequestURL(event).pathname

    //only protecting api routes.
    if (!path.startsWith('/api')) return

    //allow public routes
    if (PUBLIC_ROUTES.some((r) => path.startsWith(r))) return

    await requireUserSession(event)

    // The role in the session may be stale (changed on /staff since login).
    await syncStaffSession(event)
})
