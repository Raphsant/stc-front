export async function requireSuperAdmin(event: any) {
    const { user } = await getUserSession(event)
    if ((user as any).role !== 'superadmin') {
        throw createError({ statusCode: 403, statusMessage: 'Se requieren permisos de superadmin' })
    }
    return user
}

export function isSuperAdmin(user: any): boolean {
    return user?.role === 'superadmin'
}
