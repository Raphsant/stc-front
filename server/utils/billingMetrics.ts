import { answerFor, canExport, EXPORT_REPORTS, REPORT_SCOPE, type MetricsReport } from '../../shared/metricsAccess'
import { hasScope } from '../../shared/permissions'

// The metrics proxy: /api/billing/metrics/* → stc-billing /api/admin/metrics/*.
// Read-only. stc-billing cannot tell staff apart (one shared key), so each route
// here checks the staff member's scope first, forwards only whitelisted
// parameters, and gives a role without metrics:money the count-only view
// (shared/metricsAccess.ts).

const DAY = /^\d{4}-\d{2}-\d{2}$/
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

type Param = 'from' | 'to' | 'month' | 'bucket' | 'groupBy' | 'source' | 'limit'
const CHOICES: Partial<Record<Param, readonly string[]>> = {
    bucket: ['day', 'month'],
    source: ['live', 'snapshot'],
}

/** Only these parameters, and only when they look right; anything else is dropped, not forwarded. */
export function metricsQuery(event: any, allowed: readonly Param[], groupBy: readonly string[] = []): Record<string, string | number | undefined> {
    const q = getQuery(event)
    const out: Record<string, string | number | undefined> = {}
    for (const key of allowed) {
        const value = q[key]
        if (value == null || value === '') continue
        const v = String(value)
        if ((key === 'from' || key === 'to') && DAY.test(v)) out[key] = v
        else if (key === 'month' && MONTH.test(v)) out[key] = v
        else if (key === 'groupBy' && groupBy.includes(v)) out[key] = v
        else if (key === 'limit') out[key] = Math.min(Math.max(Number(v) || 40, 1), 200)
        else if (CHOICES[key]?.includes(v)) out[key] = v
    }
    return out
}

/** One report for the logged-in staff member: 403 without its scope, dollars left out without metrics:money. */
export async function metricsReport(event: any, report: MetricsReport, path: string, query: Record<string, string | number | undefined> = {}) {
    const { user } = await getUserSession(event)
    if (!hasScope(user, REPORT_SCOPE[report])) {
        throw createError({ statusCode: 403, statusMessage: 'Tu rol no tiene permiso para ver esto' })
    }
    const answer = await billingGet(event, `/metrics${path}`, query)
    return answerFor(user, report, answer)
}

/** The CSV of a report. The file holds dollars, so the export scopes are checked before stc-billing is asked. */
export async function metricsExport(event: any) {
    const q = getQuery(event)
    const name = String(q.report || '')
    if (!Object.hasOwn(EXPORT_REPORTS, name)) {
        throw createError({ statusCode: 400, statusMessage: 'Reporte desconocido' })
    }
    const { user } = await getUserSession(event)
    if (!canExport(user, name)) {
        throw createError({ statusCode: 403, statusMessage: 'Tu rol no puede exportar este reporte' })
    }
    const query = {
        report: name,
        ...metricsQuery(event, ['from', 'to', 'month', 'bucket', 'groupBy'], ['product', 'provider', 'kind', 'source', 'medium', 'campaign', 'affiliate']),
    }
    // stc-billing writes the export to its audit log with this staff member's username.
    const csv = await billingGet<string>(event, '/metrics/export', query)
    setHeader(event, 'content-type', 'text/csv; charset=utf-8')
    setHeader(event, 'content-disposition', `attachment; filename="stc-${name}-${new Date().toISOString().slice(0, 10)}.csv"`)
    return typeof csv === 'string' ? csv : String(csv ?? '')
}
