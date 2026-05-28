import {requireUserSession} from "#imports";

const PUBLIC_ROUTES = [
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/me',
    '/api/discord-users/mass-create'
]


export default defineEventHandler(async (event) => {
    const path = getRequestURL(event).pathname

    //only protecting api routes.
    if (!path.startsWith('/api')) return

    //allow public routes
    if (PUBLIC_ROUTES.some((r) => path.startsWith(r))) return

    await requireUserSession(event)


})
