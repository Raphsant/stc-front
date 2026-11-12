// Report logic shared by the API (server/api/reports/users.get.ts), the
// Reportes page and the exports: filter parsing, tier / membership / expiry
// resolution, derived filters, summaries and the human-readable title.
import { ENGAGEMENT_STATES, getEngagementState, type EngagementState } from './engagement'

export { ENGAGEMENT_STATES }
export type { EngagementState }

const DAY = 24 * 60 * 60 * 1000

// ── Types ────────────────────────────────────────────────────────────────

export type Tier = 'alpha' | 'delta' | 'none'
export type MemberFilter = 'active' | 'removed' | 'all'
export type ExpiryFilter = '' | 'expired' | 'week' | 'month' | 'next30' | 'next60' | 'next90' | 'range' | 'none'
export type PlanStatus = 'active' | 'paused' | 'canceled' | 'churned' | 'other' | 'none'
export type SortBy = 'recent' | 'expiresAt' | 'joinedAt' | 'meetings' | 'messages30d' | 'username'
export type ExpiryBucket = 'expired' | 'd7' | 'd30' | 'd60' | 'd90' | 'later' | 'none'

export interface ReportFilters {
    q: string
    country: string // ISO code | 'none' | ''
    region: string // regionKey | 'none' | ''
    city: string // cityKey | ''
    tier: Tier[]
    member: MemberFilter
    engagement: EngagementState[]
    expiry: ExpiryFilter
    expFrom: string
    expTo: string
    plan: PlanStatus[]
    joinedFrom: string
    joinedTo: string
    meetings: '' | 'none'
    meetingsMin: number | null
    msgMin: number | null
    msgMax: number | null
    contacted: '' | 'yes' | 'no'
    contactedBy: string
    cf: '' | 'linked' | 'unlinked'
    sortBy: SortBy
    sortDir: 'asc' | 'desc'
}

export interface ReportMembership {
    source: 'alpha' | 'cf' | null
    status: PlanStatus
    expiresAt: string | null
    daysLeft: number | null
    productName: string | null
}

export interface ReportRow {
    _id: string
    username: string
    avatarUrl: string | null
    roles: string[]
    tier: Tier
    tierRole: string | null
    joinedAt: string | null
    removedAt: string | null
    memberStatus: 'active' | 'removed'
    location: {
        country: string | null
        region: string | null
        regionKey: string | null
        city: string | null
        cityKey: string | null
    }
    engagement: EngagementState
    lastActiveAt: string | null
    lastMessageAt: string | null
    lastMeetingAt: string | null
    meetingCount: number
    messages30d: number
    messageCount: number
    contactedBy: string[]
    cfLinked: boolean
    membership: ReportMembership
}

export interface ReportSummary {
    byTier: Record<Tier, number>
    byMember: Record<'active' | 'removed', number>
    byEngagement: Record<EngagementState, number>
    byExpiry: Record<ExpiryBucket, number>
    byPlan: Record<PlanStatus, number>
    byCountry: { code: string | null; count: number }[]
    byRegion: { key: string; name: string | null; count: number }[]
    byCity: { key: string; name: string; count: number }[]
    expiryCoverage: { withDate: number; withoutDate: number }
    cfSyncedAt: string | null
}

export interface ReportResponse {
    generatedAt: string
    filters: ReportFilters
    total: number
    universe: number
    rows: ReportRow[]
    summary: ReportSummary
}

// ── Labels (Spanish UI copy) ─────────────────────────────────────────────

export const TIERS: Tier[] = ['alpha', 'delta', 'none']
export const TIER_LABELS: Record<Tier, string> = { alpha: 'Alpha', delta: 'Delta', none: 'Sin tier' }

export const ENGAGEMENT_LABELS: Record<EngagementState, string> = {
    active: 'Activo',
    slipping: 'Ausente',
    inactive: 'Inactivo',
    dormant: 'Dormido',
}
export const ENGAGEMENT_HINTS: Record<EngagementState, string> = {
    active: '≤ 7 días',
    slipping: '8–30 días',
    inactive: '31–90 días',
    dormant: '> 90 días o nunca',
}

export const MEMBER_LABELS: Record<'active' | 'removed', string> = {
    active: 'En el servidor',
    removed: 'Eliminado',
}

export const PLAN_STATUSES: PlanStatus[] = ['active', 'paused', 'canceled', 'churned', 'other', 'none']
export const PLAN_LABELS: Record<PlanStatus, string> = {
    active: 'Activo',
    paused: 'Pausado',
    canceled: 'Cancelado',
    churned: 'Finalizado',
    other: 'Otro',
    none: 'Sin dato',
}

export const EXPIRY_OPTIONS: { value: ExpiryFilter; label: string }[] = [
    { value: '', label: 'Cualquiera' },
    { value: 'expired', label: 'Vencida' },
    { value: 'week', label: 'Esta semana' },
    { value: 'month', label: 'Este mes' },
    { value: 'next30', label: 'Próximos 30 días' },
    { value: 'next60', label: 'Próximos 60 días' },
    { value: 'next90', label: 'Próximos 90 días' },
    { value: 'range', label: 'Rango de fechas' },
    { value: 'none', label: 'Sin fecha' },
]

export const EXPIRY_BUCKETS: ExpiryBucket[] = ['expired', 'd7', 'd30', 'd60', 'd90', 'later', 'none']
export const EXPIRY_BUCKET_LABELS: Record<ExpiryBucket, string> = {
    expired: 'Vencida',
    d7: 'En 7 días o menos',
    d30: 'En 8–30 días',
    d60: 'En 31–60 días',
    d90: 'En 61–90 días',
    later: 'Más de 90 días',
    none: 'Sin fecha',
}

export const SORT_OPTIONS: { value: SortBy; label: string; dir: 'asc' | 'desc' }[] = [
    { value: 'recent', label: 'Actividad reciente', dir: 'desc' },
    { value: 'expiresAt', label: 'Vencimiento', dir: 'asc' },
    { value: 'joinedAt', label: 'Fecha de ingreso', dir: 'desc' },
    { value: 'meetings', label: 'Reuniones', dir: 'desc' },
    { value: 'messages30d', label: 'Mensajes 30d', dir: 'desc' },
    { value: 'username', label: 'Nombre', dir: 'asc' },
]

const regionNames = new Intl.DisplayNames(['es'], { type: 'region' })
export function countryName(code: string | null | undefined): string {
    if (!code) return 'Sin ubicación'
    try {
        return regionNames.of(code.toUpperCase()) ?? code
    } catch {
        return code
    }
}

// ── Filters: defaults, parse, serialise ──────────────────────────────────

export function defaultFilters(): ReportFilters {
    return {
        q: '', country: '', region: '', city: '',
        tier: [], member: 'active', engagement: [],
        expiry: '', expFrom: '', expTo: '',
        plan: [],
        joinedFrom: '', joinedTo: '',
        meetings: '', meetingsMin: null,
        msgMin: null, msgMax: null,
        contacted: '', contactedBy: '',
        cf: '',
        sortBy: 'recent', sortDir: 'desc',
    }
}

function str(v: unknown): string {
    if (Array.isArray(v)) v = v[0]
    return typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : ''
}
function list<T extends string>(v: unknown, allowed: readonly T[]): T[] {
    const raw = Array.isArray(v) ? v.join(',') : str(v)
    const picked = raw.split(',').map(s => s.trim()).filter((s): s is T => (allowed as readonly string[]).includes(s))
    // Keep canonical order and drop duplicates so URLs are stable
    return allowed.filter(a => picked.includes(a))
}
function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
    const s = str(v)
    return (allowed as readonly string[]).includes(s) ? (s as T) : fallback
}
function nonNegInt(v: unknown): number | null {
    const s = str(v)
    if (!/^\d+$/.test(s)) return null
    return Number(s)
}
function isoDate(v: unknown): string {
    const s = str(v)
    return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : ''
}

/** Parse a URL / h3 query object. Unknown or invalid values fall back to defaults. */
export function parseFilters(query: Record<string, unknown> = {}): ReportFilters {
    const d = defaultFilters()
    const country = str(query.country)
    const hasCountry = !!country && country !== 'none'
    const region = hasCountry ? str(query.region) : ''
    const expiry = oneOf(query.expiry, EXPIRY_OPTIONS.map(o => o.value), '')
    const sortBy = oneOf(query.sortBy, SORT_OPTIONS.map(o => o.value), d.sortBy)
    const defaultDir = SORT_OPTIONS.find(o => o.value === sortBy)!.dir
    const meetings = oneOf(query.meetings, ['', 'none'] as const, '')
    const contacted = oneOf(query.contacted, ['', 'yes', 'no'] as const, '')
    return {
        q: str(query.q),
        country,
        region,
        city: hasCountry ? str(query.city) : '',
        tier: list(query.tier, TIERS),
        member: oneOf(query.member, ['active', 'removed', 'all'] as const, d.member),
        engagement: list(query.engagement, ENGAGEMENT_STATES),
        expiry,
        expFrom: expiry === 'range' ? isoDate(query.expFrom) : '',
        expTo: expiry === 'range' ? isoDate(query.expTo) : '',
        plan: list(query.plan, PLAN_STATUSES),
        joinedFrom: isoDate(query.joinedFrom),
        joinedTo: isoDate(query.joinedTo),
        meetings,
        meetingsMin: meetings === 'none' ? null : nonNegInt(query.meetingsMin),
        msgMin: nonNegInt(query.msgMin),
        msgMax: nonNegInt(query.msgMax),
        contacted,
        contactedBy: contacted === 'no' ? '' : str(query.contactedBy),
        cf: oneOf(query.cf, ['', 'linked', 'unlinked'] as const, ''),
        sortBy,
        sortDir: oneOf(query.sortDir, ['asc', 'desc'] as const, defaultDir),
    }
}

/** Inverse of parseFilters; omits defaults so URLs stay short. */
export function serializeFilters(f: ReportFilters): Record<string, string> {
    const out: Record<string, string> = {}
    const set = (k: string, v: string | number | null) => {
        if (v !== '' && v !== null) out[k] = String(v)
    }
    set('q', f.q)
    set('country', f.country)
    set('region', f.region)
    set('city', f.city)
    set('tier', f.tier.join(','))
    if (f.member !== 'active') out.member = f.member
    set('engagement', f.engagement.join(','))
    set('expiry', f.expiry)
    set('expFrom', f.expFrom)
    set('expTo', f.expTo)
    set('plan', f.plan.join(','))
    set('joinedFrom', f.joinedFrom)
    set('joinedTo', f.joinedTo)
    set('meetings', f.meetings)
    set('meetingsMin', f.meetingsMin)
    set('msgMin', f.msgMin)
    set('msgMax', f.msgMax)
    set('contacted', f.contacted)
    set('contactedBy', f.contactedBy)
    set('cf', f.cf)
    const defaultDir = SORT_OPTIONS.find(o => o.value === f.sortBy)!.dir
    if (f.sortBy !== 'recent') out.sortBy = f.sortBy
    if (f.sortDir !== defaultDir) out.sortDir = f.sortDir
    return out
}

// ── Derivations ──────────────────────────────────────────────────────────

/**
 * Tier family from Discord role names. "Alpha." / "Delta." are grouped with
 * their family; the exact role is returned as tierRole. A paused Alpha loses
 * the Discord role but still has a memberships doc, so that counts as alpha.
 */
export function classifyTier(roles: string[] = [], alphaStatus?: string | null): { tier: Tier; tierRole: string | null } {
    const norm = (r: string) => r.toLowerCase().replace(/[^a-z]/g, '')
    const alphaRole = roles.find(r => norm(r).includes('alpha'))
    if (alphaRole) return { tier: 'alpha', tierRole: alphaRole }
    if (alphaStatus === 'active' || alphaStatus === 'paused') return { tier: 'alpha', tierRole: null }
    const deltaRole = roles.find(r => norm(r).includes('delta'))
    if (deltaRole) return { tier: 'delta', tierRole: deltaRole }
    return { tier: 'none', tierRole: null }
}

function startOfUtcDay(t: number): number {
    return Math.floor(t / DAY) * DAY
}

/** Whole UTC days from today to the expiry date (negative once past). */
export function daysLeft(expiresAt: string | Date | null | undefined, now: number): number | null {
    if (!expiresAt) return null
    const t = new Date(expiresAt).getTime()
    if (Number.isNaN(t)) return null
    return Math.round((startOfUtcDay(t) - startOfUtcDay(now)) / DAY)
}

function planStatus(s: unknown): PlanStatus {
    if (s === 'active' || s === 'paused' || s === 'canceled' || s === 'churned') return s
    return s ? 'other' : 'none'
}

/**
 * One expiry per user: the Alpha membership doc (stc-payments) wins while it
 * is active or paused; otherwise the ClickFunnels subscription synced by
 * stcbot; otherwise unknown.
 */
export function resolveMembership(
    alpha: { status?: string | null; expiresAt?: Date | string | null } | null | undefined,
    cf: { status?: string | null; expiresAt?: Date | string | null; productName?: string | null; syncedAt?: Date | string | null } | null | undefined,
    now: number,
): ReportMembership {
    const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null)
    if (alpha && (alpha.status === 'active' || alpha.status === 'paused')) {
        const expiresAt = iso(alpha.expiresAt)
        return { source: 'alpha', status: alpha.status, expiresAt, daysLeft: daysLeft(expiresAt, now), productName: 'Alpha' }
    }
    if (cf?.syncedAt) {
        const expiresAt = iso(cf.expiresAt)
        return { source: 'cf', status: planStatus(cf.status), expiresAt, daysLeft: daysLeft(expiresAt, now), productName: cf.productName ?? null }
    }
    return { source: null, status: 'none', expiresAt: null, daysLeft: null, productName: null }
}

/** Disjoint bucket used by the summary. */
export function expiryBucket(days: number | null): ExpiryBucket {
    if (days === null) return 'none'
    if (days < 0) return 'expired'
    if (days <= 7) return 'd7'
    if (days <= 30) return 'd30'
    if (days <= 60) return 'd60'
    if (days <= 90) return 'd90'
    return 'later'
}

/**
 * Expiry filter. "week" is today through Sunday, "month" is today through the
 * last day of the calendar month, both in UTC; nextN is today through today+N.
 */
export function matchesExpiry(m: ReportMembership, f: Pick<ReportFilters, 'expiry' | 'expFrom' | 'expTo'>, now: number): boolean {
    if (!f.expiry) return true
    const d = m.daysLeft
    if (f.expiry === 'none') return d === null
    if (d === null) return false
    if (f.expiry === 'expired') return d < 0
    if (f.expiry === 'range') {
        const day = startOfUtcDay(new Date(m.expiresAt!).getTime())
        if (f.expFrom && day < Date.parse(f.expFrom)) return false
        if (f.expTo && day > Date.parse(f.expTo)) return false
        return true
    }
    if (d < 0) return false
    const today = new Date(startOfUtcDay(now))
    if (f.expiry === 'week') {
        const dow = today.getUTCDay() // 0 = Sunday
        return d <= (dow === 0 ? 0 : 7 - dow)
    }
    if (f.expiry === 'month') {
        const lastDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).getUTCDate()
        return d <= lastDay - today.getUTCDate()
    }
    return d <= Number(f.expiry.slice(4))
}

/** Raw aggregation document (see users.get.ts $project) → report row. */
export function toRow(doc: any, now: number): ReportRow {
    const iso = (d: any) => (d ? new Date(d).toISOString() : null)
    const alpha = doc.alpha?.[0] ?? null
    const { tier, tierRole } = classifyTier(doc.roles ?? [], alpha?.status)
    const lastMessageAt = iso(doc.lastMessageAt)
    const lastMeetingAt = iso(doc.lastMeetingAt)
    const last = Math.max(lastMessageAt ? Date.parse(lastMessageAt) : 0, lastMeetingAt ? Date.parse(lastMeetingAt) : 0)
    const loc = doc.cfLocation ?? {}
    return {
        _id: String(doc._id),
        username: doc.username ?? '',
        avatarUrl: doc.avatarUrl ?? null,
        roles: doc.roles ?? [],
        tier,
        tierRole,
        joinedAt: iso(doc.joinedAt),
        removedAt: iso(doc.removedAt),
        memberStatus: doc.removedAt ? 'removed' : 'active',
        location: {
            country: loc.country ?? null,
            region: loc.region ?? null,
            regionKey: loc.regionKey ?? null,
            city: loc.city ?? null,
            cityKey: loc.cityKey ?? null,
        },
        engagement: getEngagementState(lastMessageAt, lastMeetingAt, now).state,
        lastActiveAt: last ? new Date(last).toISOString() : null,
        lastMessageAt,
        lastMeetingAt,
        meetingCount: doc.meetingCount ?? 0,
        messages30d: doc.messages30d ?? 0,
        messageCount: doc.messageCount ?? 0,
        contactedBy: doc.contactedBy ?? [],
        cfLinked: doc.cfContactId != null,
        membership: resolveMembership(alpha, doc.cfMembership, now),
    }
}

/** Filters that depend on derived fields (the stored ones run in Mongo). */
export function applyFilters(rows: ReportRow[], f: ReportFilters, now: number): ReportRow[] {
    const contactedBy = f.contactedBy.toLowerCase()
    return rows.filter((r) => {
        if (f.tier.length && !f.tier.includes(r.tier)) return false
        if (f.engagement.length && !f.engagement.includes(r.engagement)) return false
        if (f.plan.length && !f.plan.includes(r.membership.status)) return false
        if (!matchesExpiry(r.membership, f, now)) return false
        if (f.meetings === 'none' && r.meetingCount > 0) return false
        if (f.meetingsMin !== null && r.meetingCount < f.meetingsMin) return false
        if (f.msgMin !== null && r.messages30d < f.msgMin) return false
        if (f.msgMax !== null && r.messages30d > f.msgMax) return false
        if (f.contacted === 'yes' && !r.contactedBy.length) return false
        if (f.contacted === 'no' && r.contactedBy.length) return false
        if (contactedBy && !r.contactedBy.some(a => a.toLowerCase() === contactedBy)) return false
        return true
    })
}

export function sortRows(rows: ReportRow[], sortBy: SortBy, sortDir: 'asc' | 'desc'): ReportRow[] {
    const key: Record<SortBy, (r: ReportRow) => string | number | null> = {
        recent: r => r.lastActiveAt,
        expiresAt: r => r.membership.expiresAt,
        joinedAt: r => r.joinedAt,
        meetings: r => r.meetingCount,
        messages30d: r => r.messages30d,
        username: r => r.username.toLowerCase(),
    }
    const get = key[sortBy]
    const sign = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
        const x = get(a)
        const y = get(b)
        // Missing values always go last, whatever the direction
        if (x === null && y !== null) return 1
        if (y === null && x !== null) return -1
        if (x !== null && y !== null && x !== y) return (x < y ? -1 : 1) * sign
        return a.username.localeCompare(b.username, 'es')
    })
}

function topName(counts: Map<string, number>): string | null {
    let best: string | null = null
    let n = 0
    for (const [name, c] of counts) if (c > n) { best = name; n = c }
    return best
}

export function summarize(rows: ReportRow[], f: Pick<ReportFilters, 'country' | 'region'>, cfSyncedAt: string | null = null): ReportSummary {
    const s: ReportSummary = {
        byTier: { alpha: 0, delta: 0, none: 0 },
        byMember: { active: 0, removed: 0 },
        byEngagement: { active: 0, slipping: 0, inactive: 0, dormant: 0 },
        byExpiry: { expired: 0, d7: 0, d30: 0, d60: 0, d90: 0, later: 0, none: 0 },
        byPlan: { active: 0, paused: 0, canceled: 0, churned: 0, other: 0, none: 0 },
        byCountry: [],
        byRegion: [],
        byCity: [],
        expiryCoverage: { withDate: 0, withoutDate: 0 },
        cfSyncedAt,
    }
    const countries = new Map<string, number>()
    const regions = new Map<string, { count: number; names: Map<string, number> }>()
    const cities = new Map<string, { count: number; names: Map<string, number> }>()
    const bump = (m: Map<string, { count: number; names: Map<string, number> }>, key: string, name: string | null) => {
        const e = m.get(key) ?? { count: 0, names: new Map() }
        e.count++
        if (name) e.names.set(name, (e.names.get(name) ?? 0) + 1)
        m.set(key, e)
    }
    const hasCountry = !!f.country && f.country !== 'none'

    for (const r of rows) {
        s.byTier[r.tier]++
        s.byMember[r.memberStatus]++
        s.byEngagement[r.engagement]++
        s.byExpiry[expiryBucket(r.membership.daysLeft)]++
        s.byPlan[r.membership.status]++
        if (r.membership.expiresAt) s.expiryCoverage.withDate++
        else s.expiryCoverage.withoutDate++

        const c = r.location.country ?? ''
        countries.set(c, (countries.get(c) ?? 0) + 1)
        if (hasCountry) bump(regions, r.location.regionKey ?? 'none', r.location.region)
        if (hasCountry && f.region && r.location.cityKey) bump(cities, r.location.cityKey, r.location.city)
    }

    s.byCountry = [...countries]
        .map(([code, count]) => ({ code: code || null, count }))
        .sort((a, b) => (a.code === null ? 1 : b.code === null ? -1 : b.count - a.count || a.code.localeCompare(b.code)))
    s.byRegion = [...regions]
        .map(([key, e]) => ({ key, name: key === 'none' ? null : topName(e.names) ?? key, count: e.count }))
        .sort((a, b) => (a.key === 'none' ? 1 : b.key === 'none' ? -1 : b.count - a.count || a.key.localeCompare(b.key)))
    s.byCity = [...cities]
        .map(([key, e]) => ({ key, name: topName(e.names) ?? key, count: e.count }))
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    return s
}

// ── Human-readable description ───────────────────────────────────────────

export interface LocationNames {
    region?: string | null
    city?: string | null
}

function fmtDay(s: string): string {
    const [y, m, d] = s.split('-')
    return `${d}/${m}/${y}`
}
function joinEs(parts: string[]): string {
    if (parts.length <= 1) return parts.join('')
    return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`
}

function locationLabel(f: ReportFilters, names: LocationNames): string {
    if (!f.country) return ''
    if (f.country === 'none') return 'Sin ubicación'
    const parts: string[] = []
    if (f.city) parts.push(names.city ?? f.city)
    else if (f.region) parts.push(f.region === 'none' ? 'sin provincia' : names.region ?? f.region)
    parts.push(countryName(f.country))
    return parts.join(', ')
}

function expiryPhrase(f: ReportFilters): string {
    switch (f.expiry) {
        case 'expired': return 'membresía vencida'
        case 'week': return 'vencen esta semana'
        case 'month': return 'vencen este mes'
        case 'next30': return 'vencen en 30 días'
        case 'next60': return 'vencen en 60 días'
        case 'next90': return 'vencen en 90 días'
        case 'none': return 'sin fecha de vencimiento'
        case 'range':
            if (f.expFrom && f.expTo) return `vencen entre ${fmtDay(f.expFrom)} y ${fmtDay(f.expTo)}`
            if (f.expFrom) return `vencen desde ${fmtDay(f.expFrom)}`
            if (f.expTo) return `vencen hasta ${fmtDay(f.expTo)}`
            return ''
        default: return ''
    }
}

export interface FilterChip {
    key: string
    label: string
    /** Patch that removes this filter. */
    clear: Partial<ReportFilters>
}

/** Every active filter as a removable chip; also the "Filtros:" line in exports. */
export function describeFilters(f: ReportFilters, names: LocationNames = {}): FilterChip[] {
    const chips: FilterChip[] = []
    const add = (key: string, label: string, clear: Partial<ReportFilters>) => chips.push({ key, label, clear })

    if (f.q) add('q', `Nombre: "${f.q}"`, { q: '' })
    if (f.country) add('location', locationLabel(f, names), { country: '', region: '', city: '' })
    for (const t of f.tier) add(`tier-${t}`, TIER_LABELS[t], { tier: f.tier.filter(x => x !== t) })
    if (f.member === 'removed') add('member', 'Eliminados', { member: 'active' })
    if (f.member === 'all') add('member', 'Activos y eliminados', { member: 'active' })
    for (const e of f.engagement) add(`eng-${e}`, `Actividad: ${ENGAGEMENT_LABELS[e]}`, { engagement: f.engagement.filter(x => x !== e) })
    if (f.expiry && expiryPhrase(f)) {
        const p = expiryPhrase(f)
        add('expiry', p.charAt(0).toUpperCase() + p.slice(1), { expiry: '', expFrom: '', expTo: '' })
    }
    for (const p of f.plan) add(`plan-${p}`, `Plan: ${PLAN_LABELS[p]}`, { plan: f.plan.filter(x => x !== p) })
    if (f.joinedFrom || f.joinedTo) {
        const label = f.joinedFrom && f.joinedTo
            ? `Ingreso: ${fmtDay(f.joinedFrom)} – ${fmtDay(f.joinedTo)}`
            : f.joinedFrom ? `Ingreso desde ${fmtDay(f.joinedFrom)}` : `Ingreso hasta ${fmtDay(f.joinedTo)}`
        add('joined', label, { joinedFrom: '', joinedTo: '' })
    }
    if (f.meetings === 'none') add('meetings', 'Sin reuniones', { meetings: '' })
    if (f.meetingsMin !== null) add('meetingsMin', `Reuniones ≥ ${f.meetingsMin}`, { meetingsMin: null })
    if (f.msgMin !== null) add('msgMin', `Mensajes 30d ≥ ${f.msgMin}`, { msgMin: null })
    if (f.msgMax !== null) add('msgMax', f.msgMax === 0 ? 'Sin mensajes en 30d' : `Mensajes 30d ≤ ${f.msgMax}`, { msgMax: null })
    if (f.contacted === 'no') add('contacted', 'Nunca contactados', { contacted: '' })
    if (f.contacted === 'yes' && !f.contactedBy) add('contacted', 'Contactados', { contacted: '' })
    if (f.contactedBy) add('contactedBy', `Contactado por ${f.contactedBy}`, { contactedBy: '', contacted: '' })
    if (f.cf === 'linked') add('cf', 'Con ClickFunnels', { cf: '' })
    if (f.cf === 'unlinked') add('cf', 'Sin ClickFunnels', { cf: '' })
    return chips
}

/** e.g. "Usuarios Delta en Barcelona, España · vencen en 30 días" */
export function buildReportTitle(f: ReportFilters, names: LocationNames = {}): string {
    let head = f.member === 'all' ? 'Todos los usuarios' : f.member === 'removed' ? 'Usuarios eliminados' : 'Usuarios'
    if (f.tier.length && f.tier.length < TIERS.length) {
        head += ' ' + joinEs(f.tier.map(t => (t === 'none' ? 'sin tier' : TIER_LABELS[t])))
    }
    if (f.country === 'none') head += ' sin ubicación'
    else if (f.country) head += ` en ${locationLabel(f, names)}`

    const tail: string[] = []
    const exp = expiryPhrase(f)
    if (exp) tail.push(exp)
    if (f.engagement.length) tail.push(joinEs(f.engagement.map(e => ENGAGEMENT_LABELS[e].toLowerCase())))
    const covered = new Set(['q', 'location', 'member', 'expiry'])
    for (const chip of describeFilters(f, names)) {
        if (covered.has(chip.key) || chip.key.startsWith('tier-') || chip.key.startsWith('eng-')) continue
        tail.push(chip.label.charAt(0).toLowerCase() + chip.label.slice(1))
    }
    if (f.q) tail.push(`"${f.q}"`)
    return [head, ...tail].join(' · ')
}

export function countActiveFilters(f: ReportFilters): number {
    return describeFilters(f).length
}
