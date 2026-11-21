import mongoose from 'mongoose'
import { STAFF_ROLES, type StaffRole } from '../../shared/permissions'
import { ensureMongo } from './db'
import { User } from '../models/User.schema'

/**
 * The session holds the role it was given at login, but a superadmin can change it
 * on /staff at any time. On every API request the role is read again from the
 * account and the session is corrected when they differ, so a change applies from
 * that person's next request, not their next login. An account that no longer
 * exists loses its session.
 *
 * Returns the session user as it stands after the check.
 */
export async function syncStaffSession(event: any) {
    const session = await getUserSession(event)
    const user = session?.user as { id?: string; username?: string; role?: string } | undefined
    if (!user) return user

    await ensureMongo()
    const account = mongoose.isValidObjectId(user.id)
        ? await User.findById(user.id).select('username role').lean<{ username: string; role?: string }>()
        : null

    if (!account) {
        await clearUserSession(event)
        throw createError({ statusCode: 401, statusMessage: 'Tu cuenta ya no existe' })
    }

    const role: StaffRole = STAFF_ROLES.includes(account.role as StaffRole) ? (account.role as StaffRole) : 'admin'
    if (user.role === role && user.username === account.username) return user

    const next = { ...user, username: account.username, role }
    const { id: _sessionId, ...rest } = session as any
    await replaceUserSession(event, { ...rest, user: next })
    return next
}
