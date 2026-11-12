import {
    ENGAGEMENT_LABELS,
    ENGAGEMENT_STATES,
    EXPIRY_BUCKETS,
    EXPIRY_BUCKET_LABELS,
    MEMBER_LABELS,
    PLAN_LABELS,
    TIERS,
    TIER_LABELS,
    countryName,
    type ReportRow,
    type ReportSummary,
} from '#shared/reports'

export type ExportValue = string | number | Date | null

export interface ExportColumn {
    header: string
    /** Width in characters (XLSX) */
    width: number
    type: 'text' | 'number' | 'date'
    value: (r: ReportRow) => ExportValue
    /** Included in the reduced PDF column set */
    pdf?: boolean
}

export interface ExportMeta {
    title: string
    /** Active filters as readable labels */
    filters: string[]
    generatedAt: Date
    total: number
    universe: number
    summary: ReportSummary
}

const date = (s: string | null) => (s ? new Date(s) : null)

export const EXPORT_COLUMNS: ExportColumn[] = [
    { header: 'Usuario', width: 26, type: 'text', value: r => r.username, pdf: true },
    { header: 'Discord ID', width: 22, type: 'text', value: r => r._id },
    { header: 'Tier', width: 10, type: 'text', value: r => r.tierRole ?? TIER_LABELS[r.tier], pdf: true },
    { header: 'Roles', width: 30, type: 'text', value: r => r.roles.filter(x => x !== '@everyone').join(', ') },
    { header: 'País', width: 18, type: 'text', value: r => (r.location.country ? countryName(r.location.country) : null), pdf: true },
    { header: 'Provincia', width: 20, type: 'text', value: r => r.location.region, pdf: true },
    { header: 'Ciudad', width: 20, type: 'text', value: r => r.location.city, pdf: true },
    { header: 'Membresía', width: 16, type: 'text', value: r => MEMBER_LABELS[r.memberStatus], pdf: true },
    { header: 'Fecha de ingreso', width: 16, type: 'date', value: r => date(r.joinedAt) },
    { header: 'Fecha de salida', width: 16, type: 'date', value: r => date(r.removedAt) },
    { header: 'Actividad', width: 12, type: 'text', value: r => ENGAGEMENT_LABELS[r.engagement], pdf: true },
    { header: 'Última actividad', width: 16, type: 'date', value: r => date(r.lastActiveAt) },
    { header: 'Reuniones', width: 11, type: 'number', value: r => r.meetingCount },
    { header: 'Mensajes 30d', width: 13, type: 'number', value: r => r.messages30d },
    { header: 'Mensajes total', width: 14, type: 'number', value: r => r.messageCount },
    { header: 'Vencimiento', width: 14, type: 'date', value: r => date(r.membership.expiresAt), pdf: true },
    { header: 'Días para vencer', width: 16, type: 'number', value: r => r.membership.daysLeft, pdf: true },
    { header: 'Estado del plan', width: 15, type: 'text', value: r => PLAN_LABELS[r.membership.status] },
    {
        header: 'Origen', width: 14, type: 'text',
        value: r => (r.membership.source === 'alpha' ? 'Alpha' : r.membership.source === 'cf' ? 'ClickFunnels' : null),
    },
    { header: 'Contactado por', width: 22, type: 'text', value: r => r.contactedBy.join(', ') },
    { header: 'ClickFunnels vinculado', width: 20, type: 'text', value: r => (r.cfLinked ? 'Sí' : 'No') },
]

/** dd/mm/yyyy in UTC, the same day boundary the expiry maths uses. */
export function formatDay(d: Date | string | null): string {
    if (!d) return ''
    const x = new Date(d)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${p(x.getUTCDate())}/${p(x.getUTCMonth() + 1)}/${x.getUTCFullYear()}`
}

export function formatDateTime(d: Date): string {
    return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Summary breakdowns as label/count sections, shared by XLSX and PDF. */
export function summarySections(s: ReportSummary): { title: string; items: [string, number][] }[] {
    const sections: { title: string; items: [string, number][] }[] = [
        { title: 'Por tier', items: TIERS.map(t => [TIER_LABELS[t], s.byTier[t]]) },
        { title: 'Por actividad', items: ENGAGEMENT_STATES.map(e => [ENGAGEMENT_LABELS[e], s.byEngagement[e]]) },
        { title: 'Por vencimiento', items: EXPIRY_BUCKETS.map(b => [EXPIRY_BUCKET_LABELS[b], s.byExpiry[b]]) },
        { title: 'Por país', items: s.byCountry.map(c => [countryName(c.code), c.count]) },
    ]
    if (s.byRegion.length) sections.push({ title: 'Por provincia', items: s.byRegion.map(r => [r.name ?? 'Sin provincia', r.count]) })
    if (s.byCity.length) sections.push({ title: 'Por ciudad', items: s.byCity.map(c => [c.name, c.count]) })
    return sections.map(sec => ({ ...sec, items: sec.items.filter(([, n]) => n > 0) })).filter(sec => sec.items.length)
}

/** reporte-usuarios_<slug>_<YYYY-MM-DD>.<ext> */
export function exportFileName(title: string, generatedAt: Date, ext: string): string {
    const slug = title
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)
        .replace(/-+$/, '')
    return `reporte-${slug || 'usuarios'}_${generatedAt.toISOString().slice(0, 10)}.${ext}`
}
