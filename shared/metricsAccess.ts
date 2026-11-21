import { hasScope, type MetricScope } from './permissions'

// What each stc-billing metrics report needs, and what a staff member without
// metrics:money gets of it. Pure: the server routes enforce it
// (server/utils/billingMetrics.ts), the page uses it to decide what to show.
//
// stc-billing's reports mix counts and dollars (the summary has subscribers and
// MRR). For a role without metrics:money the answer is REBUILT from a fixed list
// of count fields, never the full answer with some fields removed: a field
// stc-billing adds later stays hidden until it is listed here.

export type MetricsReport =
    | 'summary'
    | 'mrr'
    | 'revenue'
    | 'churn'
    | 'failed-payments'
    | 'failed-payments-open'
    | 'signups'
    | 'reconciliation'

/** The scope a report needs at all. */
export const REPORT_SCOPE: Record<MetricsReport, MetricScope> = {
    summary: 'metrics:counts',
    churn: 'metrics:counts',
    'failed-payments': 'metrics:counts',
    signups: 'metrics:counts',
    // nothing but dollars
    mrr: 'metrics:money',
    revenue: 'metrics:money',
    // names and emails
    'failed-payments-open': 'metrics:members',
    // provider ids and amounts that did not match
    reconciliation: 'metrics:admin',
}

/** Reports that have something left to show once the dollars are taken out. */
const COUNTS_ONLY_VIEW: ReadonlySet<MetricsReport> = new Set(['summary', 'churn', 'failed-payments', 'failed-payments-open', 'signups'])

export function canSeeReport(user: unknown, report: MetricsReport): boolean {
    return hasScope(user, REPORT_SCOPE[report])
}

/** The CSV exports stc-billing offers, and the report each one is the export of. */
export const EXPORT_REPORTS: Record<string, MetricsReport> = {
    summary: 'summary',
    mrr: 'mrr',
    revenue: 'revenue',
    churn: 'churn',
    renewals: 'churn',
    'failed-payments': 'failed-payments',
    'failed-payments-open': 'failed-payments-open',
    signups: 'signups',
    reconciliation: 'reconciliation',
}

/**
 * A CSV is the whole report, dollars included, so exporting needs metrics:export,
 * the report's own scope, and metrics:money unless the export holds no dollars.
 */
export function canExport(user: unknown, exportName: string): boolean {
    if (!Object.hasOwn(EXPORT_REPORTS, exportName)) return false
    const report = EXPORT_REPORTS[exportName]!
    if (!hasScope(user, 'metrics:export') || !canSeeReport(user, report)) return false
    const noDollars = exportName === 'signups' || exportName === 'renewals'
    return noDollars || hasScope(user, 'metrics:money')
}

const pick = <T extends Record<string, any>>(o: T | null | undefined, keys: readonly string[]) => {
    const out: Record<string, unknown> = {}
    if (o && typeof o === 'object') for (const k of keys) if (k in o) out[k] = o[k]
    return out
}
const list = (v: unknown, keys: readonly string[]) => (Array.isArray(v) ? v.map((row) => pick(row, keys)) : [])

const VARIANT = ['priceId', 'serviceId', 'serviceName', 'nickname', 'interval', 'intervalCount'] as const

/**
 * The count-only view of a report's `data`. Every field is named here; nothing
 * else passes. Reports with nothing but dollars have no such view (null).
 */
export function countsView(report: MetricsReport, data: any): Record<string, unknown> | null {
    if (!COUNTS_ONLY_VIEW.has(report)) return null
    switch (report) {
        case 'summary':
            return {
                ...pick(data, ['activeSubscribers', 'atRiskSubscribers', 'scheduledToCancelSubscribers', 'importedWaiting', 'today', 'month']),
                byVariant: list(data?.byVariant, [...VARIANT, 'subscribers']),
                byProvider: list(data?.byProvider, ['provider', 'subscribers']),
            }
        case 'churn':
            return {
                ...pick(data, ['month', 'activeOnDay1', 'subscriberChurnRate', 'reactivations', 'cancelRequests', 'cancelReversals']),
                churned: pick(data?.churned, ['voluntary', 'involuntary', 'revoked', 'total']),
                churnRateByType: pick(data?.churnRateByType, ['voluntary', 'involuntary', 'revoked']),
                ended: pick(data?.ended, ['voluntary', 'involuntary', 'revoked', 'neverPaid', 'total']),
                renewalByVariant: list(data?.renewalByVariant, [...VARIANT, 'due', 'renewed', 'notRenewed', 'pending', 'renewalRate']),
            }
        case 'failed-payments':
            return {
                ...pick(data, ['month', 'failed', 'recoveredInGrace', 'recoveredAfterGrace', 'lost', 'open', 'recoveryRate', 'inGraceRecoveryRate', 'medianDaysToRecover', 'actionRequired']),
                byFailureCode: list(data?.byFailureCode, ['code', 'failed', 'recovered', 'lost', 'open']),
            }
        case 'failed-payments-open':
            return {
                ...pick(data, ['count']),
                open: (Array.isArray(data?.open) ? data.open : []).map((row: any) => ({
                    ...pick(row, ['provider', 'invoiceId', 'subscriptionId', 'customerId', 'firstFailedAt', 'attempts', 'failureCode', 'failureMessage', 'nextRetryAt', 'source', 'outcome', 'serviceName', 'nickname', 'subscriptionStatus', 'access', 'graceEndsAt', 'paidThrough']),
                    customer: row?.customer ? pick(row.customer, ['id', 'discordId', 'username', 'email']) : null,
                })),
            }
        case 'signups':
            return {
                ...pick(data, ['from', 'to', 'groupBy', 'signups']),
                groups: list(data?.groups, ['key', 'signups', 'subscriptions', 'oneTime']),
                accounts: {
                    ...pick(data?.accounts, ['created', 'paid', 'conversionRate']),
                    groups: list(data?.accounts?.groups, ['key', 'created', 'paid', 'conversionRate']),
                },
            }
        default:
            return null
    }
}

export interface MetricsAnswer<T = any> {
    as_of: string
    source: 'live' | 'snapshot'
    definition_version: number
    data: T
    /** true when the dollars were left out for this staff member */
    redacted?: boolean
}

/**
 * What a staff member gets of an stc-billing answer: all of it with metrics:money,
 * the count-only view without. Throws nothing: the caller has already checked the
 * report's own scope.
 */
export function answerFor(user: unknown, report: MetricsReport, answer: any): MetricsAnswer {
    const envelope = pick(answer, ['as_of', 'source', 'definition_version']) as Omit<MetricsAnswer, 'data'>
    if (hasScope(user, 'metrics:money')) return { ...envelope, data: answer?.data }
    return { ...envelope, data: countsView(report, answer?.data), redacted: true }
}
