import { hasScope, type MetricScope } from '../../shared/permissions'

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

/**
 * 403 unless the logged-in staff member's role carries `scope`
 * (shared/permissions.ts). Returns the session user.
 */
export async function requireScope(event: any, scope: MetricScope) {
    const { user } = await getUserSession(event)
    if (!hasScope(user, scope)) {
        throw createError({ statusCode: 403, statusMessage: 'Tu rol no tiene permiso para ver esto' })
    }
    return user
}
