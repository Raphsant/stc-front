import { describe, expect, it } from 'vitest'
import { answerFor, canExport, canSeeReport, countsView, EXPORT_REPORTS, REPORT_SCOPE, type MetricsReport } from '#shared/metricsAccess'
import fixtures from '../fixtures/billingMetrics.json'

// tests/fixtures/billingMetrics.json holds real answers of stc-billing's metrics
// endpoints (generated from its own test world), so these tests run against the
// actual shapes.

const OWNER = { role: 'superadmin' }
const FINANCE = { role: 'finance' }
const SUPPORT = { role: 'admin' }

/** Every [path, value] of an object, depth first. */
function leaves(value: unknown, path = ''): Array<[string, unknown]> {
    if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`))
    if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k))
    return [[path, value]]
}
/** Field names that hold dollars in stc-billing's answers. A rate is not dollars. */
const isMoneyKey = (path: string) => {
    const key = path.split('.').pop()!.replace(/\[\d+\]$/, '')
    // "net" on its own or as a word in the name (netRevenue), not inside another word (oneTime).
    return (/mrr|amount|gross|revenue|refund|chargeback|monthly/i.test(key) || /^net([A-Z]|$)|Net([A-Z]|$)/.test(key)) && !/rate$/i.test(key)
}
const moneyFields = (data: unknown) => leaves(data).filter(([path, v]) => isMoneyKey(path) && typeof v === 'number').map(([path]) => path)

describe('who sees which report', () => {
    it('opens every report to the owner, all but reconciliation to finance', () => {
        const reports = Object.keys(REPORT_SCOPE) as MetricsReport[]
        expect(reports.filter((r) => !canSeeReport(OWNER, r))).toEqual([])
        expect(reports.filter((r) => !canSeeReport(FINANCE, r))).toEqual(['reconciliation'])
    })

    it('keeps support out of the reports that are nothing but dollars, and out of reconciliation', () => {
        const reports = Object.keys(REPORT_SCOPE) as MetricsReport[]
        expect(reports.filter((r) => canSeeReport(SUPPORT, r)).sort()).toEqual(['churn', 'failed-payments', 'failed-payments-open', 'signups', 'summary'])
        expect(reports.filter((r) => canSeeReport(null, r))).toEqual([])
    })
})

describe('the count-only view', () => {
    const cases: Array<[MetricsReport, any]> = [
        ['summary', fixtures.summary.data],
        ['churn', fixtures.churn.data],
        ['failed-payments', fixtures.failedPayments.data],
        ['failed-payments-open', fixtures.failedPaymentsOpen.data],
        ['signups', fixtures.signupsBySource.data],
    ]

    it.each(cases)('%s holds no dollar field at all', (report, data) => {
        // The fixture itself does carry dollars (signups never had any).
        if (report !== 'signups') expect(moneyFields(data).length).toBeGreaterThan(0)
        expect(moneyFields(countsView(report, data))).toEqual([])
    })

    it('keeps the counts of the summary', () => {
        const view: any = countsView('summary', fixtures.summary.data)
        const full = fixtures.summary.data
        expect(view).toMatchObject({
            activeSubscribers: full.activeSubscribers,
            atRiskSubscribers: full.atRiskSubscribers,
            scheduledToCancelSubscribers: full.scheduledToCancelSubscribers,
            importedWaiting: full.importedWaiting,
        })
        expect(view.byVariant.map((v: any) => [v.nickname, v.subscribers])).toEqual(full.byVariant.map((v) => [v.nickname, v.subscribers]))
        expect(Object.keys(view.byVariant[0]).sort()).toEqual(['interval', 'intervalCount', 'nickname', 'priceId', 'serviceId', 'serviceName', 'subscribers'])
        expect(view).not.toHaveProperty('revenueToday')
        expect(view).not.toHaveProperty('mrr')
    })

    it('keeps churn counts and rates, and renewal rates by variant', () => {
        const view: any = countsView('churn', fixtures.churn.data)
        const full = fixtures.churn.data
        expect(view.churned).toEqual(full.churned)
        expect(view.subscriberChurnRate).toBe(full.subscriberChurnRate)
        expect(view.renewalByVariant).toHaveLength(full.renewalByVariant.length)
        expect(view).not.toHaveProperty('mrrChurned')
        // A rate of dollars is still dollars' business: left out with them.
        expect(view).not.toHaveProperty('mrrChurnRate')
    })

    it('keeps who is failing and why in the open list, without the amounts', () => {
        const view: any = countsView('failed-payments-open', fixtures.failedPaymentsOpen.data)
        expect(view.count).toBe(fixtures.failedPaymentsOpen.data.count)
        expect(view.open[0].customer).toEqual(fixtures.failedPaymentsOpen.data.open[0]!.customer)
        expect(view.open[0]).toMatchObject({ failureCode: 'insufficient_funds', access: 'grace' })
        expect(view.open[0]).not.toHaveProperty('amount')
        expect(view.open[0]).not.toHaveProperty('mrr')
    })

    it('hides a field stc-billing adds later until it is listed', () => {
        const view: any = countsView('summary', { ...fixtures.summary.data, lifetimeValue: 123456, byVariant: [{ ...fixtures.summary.data.byVariant[0], arpu: 999 }] })
        expect(view).not.toHaveProperty('lifetimeValue')
        expect(view.byVariant[0]).not.toHaveProperty('arpu')
    })

    it('has no view for a report that is nothing but dollars', () => {
        expect(countsView('mrr', fixtures.mrrByMonth.data)).toBeNull()
        expect(countsView('revenue', fixtures.revenueByKind.data)).toBeNull()
        expect(countsView('reconciliation', fixtures.reconciliation.data)).toBeNull()
    })

    it('survives an answer that is not what it expects', () => {
        expect(countsView('summary', null)).toEqual({ byVariant: [], byProvider: [] })
        expect(countsView('failed-payments-open', { open: 'x' })).toEqual({ open: [] })
    })
})

describe('answerFor', () => {
    it('gives finance and the owner the answer as stc-billing sent it', () => {
        for (const user of [OWNER, FINANCE]) {
            const a = answerFor(user, 'summary', fixtures.summary)
            expect(a.data).toEqual(fixtures.summary.data)
            expect(a.redacted).toBeUndefined()
            expect(a).toMatchObject({ as_of: fixtures.summary.as_of, source: 'live', definition_version: fixtures.summary.definition_version })
        }
    })

    it('gives support the count-only view, marked as such', () => {
        const a = answerFor(SUPPORT, 'summary', fixtures.summary)
        expect(a.redacted).toBe(true)
        expect(moneyFields(a.data)).toEqual([])
        expect(a.as_of).toBe(fixtures.summary.as_of)
    })
})

describe('exports', () => {
    it('lets the owner and finance export; finance not the reconciliation', () => {
        const names = Object.keys(EXPORT_REPORTS)
        expect(names.filter((n) => !canExport(OWNER, n))).toEqual([])
        expect(names.filter((n) => !canExport(FINANCE, n))).toEqual(['reconciliation'])
    })

    it('lets support export nothing, and nobody an unknown report', () => {
        expect(Object.keys(EXPORT_REPORTS).filter((n) => canExport(SUPPORT, n))).toEqual([])
        expect(canExport(OWNER, 'everything')).toBe(false)
        expect(canExport(OWNER, 'constructor')).toBe(false)
    })
})
