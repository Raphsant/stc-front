import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// server/middleware/auth.ts: which /api paths need a session, and that every one
// that does gets its role brought up to date first.


const requireUserSession = vi.fn()
const syncStaffSession = vi.fn()
let middleware: (e: any) => Promise<any>
const at = (pathname: string) => ({ pathname })

beforeAll(async () => {
    vi.stubGlobal('requireUserSession', requireUserSession)
    vi.stubGlobal('syncStaffSession', syncStaffSession)
    vi.stubGlobal('getRequestURL', (e: any) => new URL(`http://x${e.pathname}`))
    middleware = (await import('#server/middleware/auth')).default as any
})

beforeEach(() => {
    requireUserSession.mockReset().mockResolvedValue({ user: { id: '1' } })
    syncStaffSession.mockReset().mockResolvedValue({ id: '1' })
})

describe('auth middleware', () => {
    it('checks the session and refreshes the role on protected routes', async () => {
        for (const p of ['/api/staff/users', '/api/billing/metrics/summary', '/api/_auth/session']) {
            await middleware(at(p))
        }
        expect(requireUserSession).toHaveBeenCalledTimes(3)
        expect(syncStaffSession).toHaveBeenCalledTimes(3)
    })

    it('stops at the session check when there is none', async () => {
        requireUserSession.mockRejectedValue({ statusCode: 401 })
        await expect(middleware(at('/api/staff/users'))).rejects.toMatchObject({ statusCode: 401 })
        expect(syncStaffSession).not.toHaveBeenCalled()
    })

    it('lets register through so the first run can reach it (it checks for itself)', async () => {
        for (const p of ['/api/auth/register', '/api/auth/login', '/dashboard']) await middleware(at(p))
        expect(requireUserSession).not.toHaveBeenCalled()
    })
})
