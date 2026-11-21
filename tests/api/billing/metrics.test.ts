import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import fixtures from '../../fixtures/billingMetrics.json'

// The metrics proxy: each route checks the staff member's scope before stc-billing
// is asked, forwards only whitelisted parameters, and leaves the dollars out for a
// role without metrics:money.

vi.mock('#app/nuxt', async (orig) => ({
    ...(await orig<any>()),
    useRuntimeConfig: () => ({ billingApiUrl: 'http://billing.test/', billingAdminApiKey: 'k' }),
}))

const getUserSession = vi.fn()
const fetchMock = vi.fn()
const setHeader = vi.fn()
const OWNER = { user: { username: 'raph', role: 'superadmin' } }
const FINANCE = { user: { username: 'ana', role: 'finance' } }
const SUPPORT = { user: { username: 'bernardo', role: 'admin' } }

const routes: Record<string, (e: any) => Promise<any>> = {}

beforeAll(async () => {
    vi.stubGlobal('getUserSession', getUserSession)
    vi.stubGlobal('$fetch', fetchMock)
    vi.stubGlobal('setHeader', setHeader)
    const roles = await import('#server/utils/roles')
    const billing = await import('#server/utils/billing')
    const metrics = await import('#server/utils/billingMetrics')
    for (const mod of [roles, billing, metrics]) for (const [name, fn] of Object.entries(mod)) vi.stubGlobal(name, fn)

    routes.summary = (await import('#server/api/billing/metrics/summary.get')).default as any
    routes.mrr = (await import('#server/api/billing/metrics/mrr.get')).default as any
    routes.revenue = (await import('#server/api/billing/metrics/revenue.get')).default as any
    routes.churn = (await import('#server/api/billing/metrics/churn.get')).default as any
    routes.failed = (await import('#server/api/billing/metrics/failed-payments/index.get')).default as any
    routes.open = (await import('#server/api/billing/metrics/failed-payments/open.get')).default as any
    routes.signups = (await import('#server/api/billing/metrics/signups.get')).default as any
    routes.reconciliation = (await import('#server/api/billing/metrics/reconciliation.get')).default as any
    routes.export = (await import('#server/api/billing/metrics/export.get')).default as any
})

const query = (q: Record<string, unknown>) => (globalThis as any).getQuery.mockReturnValue(q)

beforeEach(() => {
    getUserSession.mockReset().mockResolvedValue(OWNER)
    fetchMock.mockReset().mockResolvedValue(fixtures.summary)
    setHeader.mockReset()
    ;(globalThis as any).getQuery = vi.fn().mockReturnValue({})
})

describe('scopes', () => {
    it.each(['mrr', 'revenue', 'reconciliation', 'export'])('refuses support the %s route without asking stc-billing', async (name) => {
        getUserSession.mockResolvedValue(SUPPORT)
        query({ report: 'summary' })
        await expect(routes[name]!({})).rejects.toMatchObject({ statusCode: 403 })
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('refuses finance the reconciliation', async () => {
        getUserSession.mockResolvedValue(FINANCE)
        await expect(routes.reconciliation!({})).rejects.toMatchObject({ statusCode: 403 })
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('refuses a session with no role, or one it does not know, everything', async () => {
        for (const session of [{ user: { username: 'x' } }, { user: { username: 'x', role: 'intern' } }, {}]) {
            getUserSession.mockResolvedValue(session)
            for (const name of ['summary', 'churn', 'failed', 'open', 'signups', 'mrr', 'revenue', 'reconciliation']) {
                await expect(routes[name]!({})).rejects.toMatchObject({ statusCode: 403 })
            }
        }
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('forwards with the key and the staff user for the audit log', async () => {
        await routes.summary!({})
        expect(fetchMock).toHaveBeenCalledWith('/api/admin/metrics/summary', expect.objectContaining({
            baseURL: 'http://billing.test',
            method: 'GET',
            headers: { 'x-api-key': 'k', 'x-staff-user': 'raph' },
        }))
    })
})

describe('what comes back', () => {
    it('gives the owner and finance the summary as stc-billing sent it', async () => {
        for (const session of [OWNER, FINANCE]) {
            getUserSession.mockResolvedValue(session)
            const res = await routes.summary!({})
            expect(res.data).toEqual(fixtures.summary.data)
            expect(res.redacted).toBeUndefined()
        }
    })

    it('gives support the summary without a single dollar', async () => {
        getUserSession.mockResolvedValue(SUPPORT)
        const res = await routes.summary!({})
        expect(res.redacted).toBe(true)
        expect(res.data.activeSubscribers).toBe(fixtures.summary.data.activeSubscribers)
        const text = JSON.stringify(res.data)
        for (const key of ['mrr', 'Mrr', 'revenue', 'gross', 'net', 'amount']) expect(text).not.toContain(key)
    })

    it('gives support churn, failed payments and the open list, counts only', async () => {
        getUserSession.mockResolvedValue(SUPPORT)
        fetchMock.mockResolvedValue(fixtures.churn)
        expect((await routes.churn!({})).data).not.toHaveProperty('mrrChurned')
        fetchMock.mockResolvedValue(fixtures.failedPayments)
        const failed = await routes.failed!({})
        expect(failed.data.failed).toBe(fixtures.failedPayments.data.failed)
        expect(failed.data).not.toHaveProperty('failedAmount')
        fetchMock.mockResolvedValue(fixtures.failedPaymentsOpen)
        const open = await routes.open!({})
        expect(open.data.open[0].customer.email).toBe(fixtures.failedPaymentsOpen.data.open[0]!.customer!.email)
        expect(open.data.open[0]).not.toHaveProperty('amount')
    })

    it('passes an upstream error through with its status and message', async () => {
        fetchMock.mockRejectedValue({ response: { status: 400 }, data: { message: 'month debe ser YYYY-MM' } })
        await expect(routes.churn!({})).rejects.toMatchObject({ statusCode: 400, statusMessage: 'month debe ser YYYY-MM' })
        fetchMock.mockRejectedValue({ response: { status: 401 } })
        await expect(routes.churn!({})).rejects.toMatchObject({ statusCode: 502 })
    })
})

describe('parameters', () => {
    it('forwards only the ones a route takes, and only when they look right', async () => {
        query({ from: '2026-11-01', to: '2026-11-20', bucket: 'month', source: 'snapshot', groupBy: 'kind', month: '2026-11', limit: '5', evil: '1' })
        await routes.mrr!({})
        expect(fetchMock.mock.calls[0]![1].query).toEqual({ from: '2026-11-01', to: '2026-11-20', bucket: 'month', source: 'snapshot' })

        fetchMock.mockClear()
        await routes.revenue!({})
        expect(fetchMock.mock.calls[0]![1].query).toEqual({ from: '2026-11-01', to: '2026-11-20', groupBy: 'kind' })

        fetchMock.mockClear()
        await routes.churn!({})
        expect(fetchMock.mock.calls[0]![1].query).toEqual({ month: '2026-11' })
    })

    it('drops what does not look right instead of forwarding it', async () => {
        query({ from: '2026-11-01; drop', to: 'hoy', bucket: 'week', groupBy: 'customer', month: '2026-13' })
        await routes.mrr!({})
        expect(fetchMock.mock.calls[0]![1].query).toEqual({})
        fetchMock.mockClear()
        await routes.signups!({})
        expect(fetchMock.mock.calls[0]![1].query).toEqual({})
        fetchMock.mockClear()
        await routes.churn!({})
        expect(fetchMock.mock.calls[0]![1].query).toEqual({})
    })

    it('takes each route its own groupings', async () => {
        query({ groupBy: 'campaign' })
        await routes.signups!({})
        expect(fetchMock.mock.calls[0]![1].query).toEqual({ groupBy: 'campaign' })
        fetchMock.mockClear()
        await routes.revenue!({})
        expect(fetchMock.mock.calls[0]![1].query).toEqual({})
    })

    it('caps the number of reconciliation runs asked for', async () => {
        query({ limit: '99999' })
        await routes.reconciliation!({})
        expect(fetchMock.mock.calls[0]![1].query).toEqual({ limit: 200 })
    })
})

describe('export', () => {
    it('returns the CSV as a download for finance', async () => {
        getUserSession.mockResolvedValue(FINANCE)
        fetchMock.mockResolvedValue(fixtures.exportMrr)
        query({ report: 'mrr', from: '2026-09-01', to: '2026-11-20', bucket: 'month', evil: 'x' })
        const csv = await routes.export!({})
        expect(csv.split('\r\n')[0]).toBe('period,start,new,migrated,reactivated,churned,end')
        expect(fetchMock).toHaveBeenCalledWith('/api/admin/metrics/export', expect.objectContaining({
            query: { report: 'mrr', from: '2026-09-01', to: '2026-11-20', bucket: 'month' },
            headers: { 'x-api-key': 'k', 'x-staff-user': 'ana' },
        }))
        expect(setHeader).toHaveBeenCalledWith(expect.anything(), 'content-type', 'text/csv; charset=utf-8')
        expect(setHeader.mock.calls[1]![2]).toMatch(/^attachment; filename="stc-mrr-\d{4}-\d{2}-\d{2}\.csv"$/)
    })

    it('refuses finance the reconciliation export and anyone an unknown report', async () => {
        getUserSession.mockResolvedValue(FINANCE)
        query({ report: 'reconciliation' })
        await expect(routes.export!({})).rejects.toMatchObject({ statusCode: 403 })
        getUserSession.mockResolvedValue(OWNER)
        query({ report: '../orders' })
        await expect(routes.export!({})).rejects.toMatchObject({ statusCode: 400 })
        query({})
        await expect(routes.export!({})).rejects.toMatchObject({ statusCode: 400 })
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
