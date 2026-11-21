import bcrypt from 'bcryptjs'
import { STAFF_ROLES, type StaffRole } from '../../shared/permissions'
import { User } from '../models/User.schema'

// stc-front staff accounts (server/models/User.schema.ts). Who may do what with
// them is checked by the routes; this file holds the rules about the accounts
// themselves.

export interface StaffAccount {
    id: string
    username: string
    role: StaffRole
    createdAt: string | null
}

export function isStaffRole(role: unknown): role is StaffRole {
    return typeof role === 'string' && (STAFF_ROLES as readonly string[]).includes(role)
}

export function toStaffAccount(doc: any): StaffAccount {
    return {
        id: String(doc._id),
        username: doc.username,
        role: isStaffRole(doc.role) ? doc.role : 'admin',
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    }
}

export async function listStaffAccounts(): Promise<StaffAccount[]> {
    const docs = await User.find({}).select('username role createdAt').sort({ createdAt: 1, username: 1 }).lean()
    return docs.map(toStaffAccount)
}

/**
 * Sets an account's role. Taking the role away from the last superadmin is
 * refused: the change is made, the superadmins are counted, and it is undone if
 * none is left. Two superadmins demoting each other at the same moment both get
 * undone, which leaves them as they were rather than with nobody in charge.
 */
export async function setStaffRole(id: string, role: StaffRole): Promise<StaffAccount> {
    const before = await User.findById(id).select('username role createdAt').lean<any>()
    if (!before) throw createError({ statusCode: 404, statusMessage: 'No existe esa cuenta' })
    if (before.role === role) return toStaffAccount(before)

    const after = await User.findByIdAndUpdate(id, { $set: { role } }, { returnDocument: 'after', runValidators: true })
        .select('username role createdAt').lean<any>()
    if (!after) throw createError({ statusCode: 404, statusMessage: 'No existe esa cuenta' })

    if (before.role === 'superadmin') {
        const left = await User.countDocuments({ role: 'superadmin' })
        if (left === 0) {
            await User.updateOne({ _id: id }, { $set: { role: 'superadmin' } })
            throw createError({ statusCode: 409, statusMessage: 'Debe quedar al menos un superadmin' })
        }
    }
    return toStaffAccount(after)
}

/** Validates and creates an account. Throws 400/409 with a message for the form. */
export async function createStaffAccount(input: { username?: unknown; password?: unknown; role?: unknown }, defaultRole: StaffRole = 'admin'): Promise<StaffAccount> {
    const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : ''
    const password = typeof input.password === 'string' ? input.password : ''
    if (!username || !password) {
        throw createError({ statusCode: 400, statusMessage: 'Usuario y contraseña son obligatorios' })
    }
    if (password.length < 8) {
        throw createError({ statusCode: 400, statusMessage: 'La contraseña debe tener al menos 8 caracteres' })
    }
    if (input.role !== undefined && input.role !== null && input.role !== '' && !isStaffRole(input.role)) {
        throw createError({ statusCode: 400, statusMessage: 'Rol no válido' })
    }
    const role = isStaffRole(input.role) ? input.role : defaultRole

    if (await User.exists({ username })) {
        throw createError({ statusCode: 409, statusMessage: 'Ese usuario ya existe' })
    }
    const passwordHash = await bcrypt.hash(password, 12)
    try {
        const user = await User.create({ username, passwordHash, role })
        return toStaffAccount(user)
    } catch (err: any) {
        // the unique index, if two requests race past the check above
        if (err?.code === 11000) throw createError({ statusCode: 409, statusMessage: 'Ese usuario ya existe' })
        throw err
    }
}
