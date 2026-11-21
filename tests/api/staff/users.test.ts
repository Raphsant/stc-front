import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import mongoose from 'mongoose'

// Staff accounts: listing and changing roles (/api/staff/users), creating accounts
// (/api/auth/register), and the session following a role change on the next
// request (server/utils/staffSession.ts).

const getUserSession = vi.fn()
const replaceUserSession = vi.fn()
const clearUserSession = vi.fn()
const requireUserSession = vi.fn(async (event: any) => {
    const s = await getUserSession(event)
    if (!s?.user) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 })
    return s
})

let User: any
let listRoute: (e: any) => Promise<any>
let patchRoute: (e: any) => Promise<any>
let registerRoute: (e: any) => Promise<any>
let meRoute: (e: any) => Promise<any>
let syncStaffSession: (e: any) => Promise<any>

const readBody = () => vi.mocked(globalThis.readBody)
const routerParam = () => vi.mocked(globalThis.getRouterParam)

async function account(username: string, role?: string) {
    const doc = await User.create({ username, passwordHash: 'x', ...(role ? { role } : {}) })
    return { doc, session: { user: { id: String(doc._id), username, role: doc.role } } }
}
const roleOf = async (username: string) => (await User.findOne({ username }).lean())?.role

beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI!)
    ;({ User } = await import('#server/models/User.schema'))
    vi.stubGlobal('User', User)
    vi.stubGlobal('getUserSession', getUserSession)
    vi.stubGlobal('replaceUserSession', replaceUserSession)
    vi.stubGlobal('clearUserSession', clearUserSession)
    vi.stubGlobal('requireUserSession', requireUserSession)

    const mods = [
        await import('#server/utils/roles'),
        await import('#server/utils/staffAccounts'),
        await import('#server/utils/staffSession'),
    ]
    for (const mod of mods) for (const [name, fn] of Object.entries(mod)) vi.stubGlobal(name, fn)
    syncStaffSession = (mods[2] as any).syncStaffSession

    listRoute = (await import('#server/api/staff/users/index.get')).default as any
    patchRoute = (await import('#server/api/staff/users/[id].patch')).default as any
    registerRoute = (await import('#server/api/auth/register.post')).default as any
    meRoute = (await import('#server/api/auth/me.get')).default as any
})

afterAll(async () => {
    await mongoose.disconnect()
})

beforeEach(async () => {
    await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})))
    await User.syncIndexes()
    getUserSession.mockReset().mockResolvedValue({})
    replaceUserSession.mockReset().mockResolvedValue({})
    clearUserSession.mockReset().mockResolvedValue(true)
    readBody().mockReset().mockResolvedValue({})
    routerParam().mockReset()
})

describe('GET /api/staff/users', () => {
    it('lists every account for a superadmin, without password hashes', async () => {
        const owner = await account('raph', 'superadmin')
        await account('ana', 'finance')
        await account('bernardo')
        getUserSession.mockResolvedValue(owner.session)

        const { users } = await listRoute({})
        expect(users.map((u: any) => [u.username, u.role])).toEqual([['raph', 'superadmin'], ['ana', 'finance'], ['bernardo', 'admin']])
        expect(JSON.stringify(users)).not.toContain('passwordHash')
        expect(users[0]).toEqual({ id: String(owner.doc._id), username: 'raph', role: 'superadmin', createdAt: expect.any(String) })
    })

    it.each(['finance', 'admin'])('refuses %s', async (role) => {
        const who = await account('someone', role)
        getUserSession.mockResolvedValue(who.session)
        await expect(listRoute({})).rejects.toMatchObject({ statusCode: 403 })
    })

    it('refuses a session without a user or a role', async () => {
        for (const s of [{}, { user: { username: 'x' } }, { user: { username: 'x', role: 'owner' } }]) {
            getUserSession.mockResolvedValue(s)
            await expect(listRoute({})).rejects.toMatchObject({ statusCode: 403 })
        }
    })
})

describe('PATCH /api/staff/users/:id', () => {
    it('lets a superadmin set any role', async () => {
        const owner = await account('raph', 'superadmin')
        const ana = await account('ana')
        getUserSession.mockResolvedValue(owner.session)
        routerParam().mockReturnValue(String(ana.doc._id))

        for (const role of ['finance', 'superadmin', 'admin']) {
            readBody().mockResolvedValue({ role })
            const { user } = await patchRoute({})
            expect(user).toMatchObject({ username: 'ana', role })
            expect(await roleOf('ana')).toBe(role)
        }
    })

    it.each(['finance', 'admin'])('refuses %s and changes nothing', async (role) => {
        const who = await account('who', role)
        const owner = await account('raph', 'superadmin')
        getUserSession.mockResolvedValue(who.session)
        routerParam().mockReturnValue(String(owner.doc._id))
        readBody().mockResolvedValue({ role: 'admin' })
        await expect(patchRoute({})).rejects.toMatchObject({ statusCode: 403 })
        // not even to promote themselves
        routerParam().mockReturnValue(String(who.doc._id))
        readBody().mockResolvedValue({ role: 'superadmin' })
        await expect(patchRoute({})).rejects.toMatchObject({ statusCode: 403 })
        expect(await roleOf('raph')).toBe('superadmin')
        expect(await roleOf('who')).toBe(role)
    })

    it('refuses a role that does not exist', async () => {
        const owner = await account('raph', 'superadmin')
        const ana = await account('ana')
        getUserSession.mockResolvedValue(owner.session)
        routerParam().mockReturnValue(String(ana.doc._id))
        for (const role of ['owner', '', null, undefined, 'toString', ['admin']]) {
            readBody().mockResolvedValue({ role })
            await expect(patchRoute({})).rejects.toMatchObject({ statusCode: 400 })
        }
        expect(await roleOf('ana')).toBe('admin')
    })

    it('answers 404 for an account that does not exist', async () => {
        const owner = await account('raph', 'superadmin')
        getUserSession.mockResolvedValue(owner.session)
        readBody().mockResolvedValue({ role: 'admin' })
        for (const id of [String(new mongoose.Types.ObjectId()), 'nope', undefined]) {
            routerParam().mockReturnValue(id as any)
            await expect(patchRoute({})).rejects.toMatchObject({ statusCode: 404 })
        }
    })

    it('never takes the role away from the last superadmin', async () => {
        const owner = await account('raph', 'superadmin')
        getUserSession.mockResolvedValue(owner.session)
        routerParam().mockReturnValue(String(owner.doc._id))
        for (const role of ['admin', 'finance']) {
            readBody().mockResolvedValue({ role })
            await expect(patchRoute({})).rejects.toMatchObject({ statusCode: 409, statusMessage: 'Debe quedar al menos un superadmin' })
            expect(await roleOf('raph')).toBe('superadmin')
        }
    })

    it('lets a superadmin step down, or demote another, while one is left', async () => {
        const owner = await account('raph', 'superadmin')
        const second = await account('eduardo', 'superadmin')
        getUserSession.mockResolvedValue(owner.session)
        routerParam().mockReturnValue(String(second.doc._id))
        readBody().mockResolvedValue({ role: 'finance' })
        await patchRoute({})
        expect(await roleOf('eduardo')).toBe('finance')

        // raph is now the only one
        routerParam().mockReturnValue(String(owner.doc._id))
        readBody().mockResolvedValue({ role: 'admin' })
        await expect(patchRoute({})).rejects.toMatchObject({ statusCode: 409 })

        await User.updateOne({ username: 'eduardo' }, { role: 'superadmin' })
        await patchRoute({})
        expect(await roleOf('raph')).toBe('admin')
        expect(await User.countDocuments({ role: 'superadmin' })).toBe(1)
    })

    it('leaves both in place when two superadmins demote each other at once', async () => {
        const a = await account('raph', 'superadmin')
        const b = await account('eduardo', 'superadmin')
        const { setStaffRole } = await import('#server/utils/staffAccounts')
        const results = await Promise.allSettled([
            setStaffRole(String(a.doc._id), 'admin'),
            setStaffRole(String(b.doc._id), 'admin'),
        ])
        expect(await User.countDocuments({ role: 'superadmin' })).toBeGreaterThanOrEqual(1)
        expect(results.some((r) => r.status === 'rejected')).toBe(true)
    })
})

describe('POST /api/auth/register', () => {
    it('lets anyone create the first account, as a superadmin, while there are none', async () => {
        readBody().mockResolvedValue({ username: ' Raph ', password: 'longenough', role: 'admin' })
        const res = await registerRoute({})
        expect(res).toMatchObject({ username: 'raph', role: 'superadmin' })
        expect(await roleOf('raph')).toBe('superadmin')
        expect(getUserSession).not.toHaveBeenCalled()
    })

    it('still checks the password on the first run', async () => {
        readBody().mockResolvedValue({ username: 'raph', password: 'short' })
        await expect(registerRoute({})).rejects.toMatchObject({ statusCode: 400 })
        expect(await User.countDocuments()).toBe(0)
    })

    it('refuses anyone not logged in once an account exists', async () => {
        await account('raph', 'superadmin')
        readBody().mockResolvedValue({ username: 'intruder', password: 'longenough' })
        await expect(registerRoute({})).rejects.toMatchObject({ statusCode: 401 })
        expect(await User.countDocuments()).toBe(1)
    })

    it.each(['finance', 'admin'])('refuses %s', async (role) => {
        await account('raph', 'superadmin')
        const who = await account('who', role)
        getUserSession.mockResolvedValue(who.session)
        readBody().mockResolvedValue({ username: 'new', password: 'longenough', role: 'superadmin' })
        await expect(registerRoute({})).rejects.toMatchObject({ statusCode: 403 })
        expect(await User.exists({ username: 'new' })).toBeNull()
    })

    it('refuses a session whose account was demoted since login', async () => {
        await account('raph', 'superadmin')
        const ex = await account('ex', 'superadmin')
        await User.updateOne({ username: 'ex' }, { role: 'admin' })
        getUserSession.mockResolvedValue(ex.session) // still says superadmin
        readBody().mockResolvedValue({ username: 'new', password: 'longenough' })
        await expect(registerRoute({})).rejects.toMatchObject({ statusCode: 403 })
    })

    it('lets a superadmin create an account with a role, admin when none is given', async () => {
        const owner = await account('raph', 'superadmin')
        getUserSession.mockResolvedValue(owner.session)

        readBody().mockResolvedValue({ username: 'ana', password: 'longenough', role: 'finance' })
        expect(await registerRoute({})).toMatchObject({ username: 'ana', role: 'finance' })
        readBody().mockResolvedValue({ username: 'bernardo', password: 'longenough' })
        expect(await registerRoute({})).toMatchObject({ username: 'bernardo', role: 'admin' })

        const stored = await User.findOne({ username: 'ana' }).lean()
        expect(stored.passwordHash).toMatch(/^\$2[aby]\$12\$/)
    })

    it('refuses a bad role, a short password, a missing field and a taken username', async () => {
        const owner = await account('raph', 'superadmin')
        getUserSession.mockResolvedValue(owner.session)
        for (const [body, status] of [
            [{ username: 'ana', password: 'longenough', role: 'owner' }, 400],
            [{ username: 'ana', password: 'short' }, 400],
            [{ username: 'ana' }, 400],
            [{ password: 'longenough' }, 400],
            [{ username: { $ne: null }, password: 'longenough' }, 400],
            [{ username: 'RAPH', password: 'longenough' }, 409],
        ] as const) {
            readBody().mockResolvedValue(body)
            await expect(registerRoute({})).rejects.toMatchObject({ statusCode: status })
        }
        expect(await User.countDocuments()).toBe(1)
    })
})

describe('the session follows the account', () => {
    it('leaves a session alone when its role is current', async () => {
        const ana = await account('ana', 'finance')
        getUserSession.mockResolvedValue(ana.session)
        expect(await syncStaffSession({})).toEqual(ana.session.user)
        expect(replaceUserSession).not.toHaveBeenCalled()
    })

    it('rewrites the role in the session after it changed', async () => {
        const ana = await account('ana', 'admin')
        getUserSession.mockResolvedValue(ana.session)
        await User.updateOne({ username: 'ana' }, { role: 'finance' })

        expect(await syncStaffSession({})).toMatchObject({ username: 'ana', role: 'finance' })
        expect(replaceUserSession).toHaveBeenCalledWith({}, expect.objectContaining({ user: expect.objectContaining({ role: 'finance' }) }))
    })

    it('reads an account with no stored role as admin, as login does', async () => {
        const doc = await User.collection.insertOne({ username: 'old', passwordHash: 'x' })
        getUserSession.mockResolvedValue({ user: { id: String(doc.insertedId), username: 'old', role: 'superadmin' } })
        expect(await syncStaffSession({})).toMatchObject({ role: 'admin' })
    })

    it('ends the session of an account that no longer exists', async () => {
        getUserSession.mockResolvedValue({ user: { id: String(new mongoose.Types.ObjectId()), username: 'gone', role: 'superadmin' } })
        await expect(syncStaffSession({})).rejects.toMatchObject({ statusCode: 401 })
        expect(clearUserSession).toHaveBeenCalled()

        getUserSession.mockResolvedValue({ user: { id: 'not-an-id', username: 'gone', role: 'superadmin' } })
        await expect(syncStaffSession({})).rejects.toMatchObject({ statusCode: 401 })
    })

    it('does nothing without a session', async () => {
        expect(await syncStaffSession({})).toBeUndefined()
        expect(replaceUserSession).not.toHaveBeenCalled()
    })

    it('makes a demotion take effect on the next request, before any role check', async () => {
        await account('raph', 'superadmin')
        const ex = await account('ex', 'superadmin')
        await User.updateOne({ username: 'ex' }, { role: 'admin' })
        // what the middleware does on the next request: the session is rewritten
        getUserSession.mockResolvedValue(ex.session)
        replaceUserSession.mockImplementation(async (_e: any, data: any) => getUserSession.mockResolvedValue(data))
        await syncStaffSession({})
        await expect(listRoute({})).rejects.toMatchObject({ statusCode: 403 })
    })

    it('/api/auth/me answers with the current role', async () => {
        const ana = await account('ana', 'admin')
        await User.updateOne({ username: 'ana' }, { role: 'finance' })
        getUserSession.mockResolvedValue(ana.session)
        expect(await meRoute({})).toMatchObject({ role: 'finance' })
    })
})
