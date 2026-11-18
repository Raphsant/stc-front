// Display helpers for the stc-billing pages (/billing/*). Labels and tones only:
// every rule about access lives in stc-billing.

export type Tone = 'green' | 'red' | 'gold' | 'blue' | 'neutral' | 'outline'
export interface StatusMeta { label: string; tone: Tone }

export const ORDER_STATUS: Record<string, StatusMeta> = {
    pending:  { label: 'Pendiente',   tone: 'neutral' },
    paid:     { label: 'Pagada',      tone: 'green' },
    failed:   { label: 'Fallida',     tone: 'red' },
    canceled: { label: 'Cancelada',   tone: 'outline' },
    refunded: { label: 'Reembolsada', tone: 'blue' },
    expired:  { label: 'Expirada',    tone: 'outline' },
}

export const SUBSCRIPTION_STATUS: Record<string, StatusMeta> = {
    incomplete: { label: 'Incompleta',   tone: 'neutral' },
    active:     { label: 'Activa',       tone: 'green' },
    past_due:   { label: 'Pago fallido', tone: 'red' },
    canceled:   { label: 'Cancelada',    tone: 'gold' },
    expired:    { label: 'Expirada',     tone: 'outline' },
}

/** Entitlement status: whether the member has the Discord role right now. */
export const ACCESS_STATUS: Record<string, StatusMeta> = {
    active:  { label: 'Con acceso', tone: 'green' },
    grace:   { label: 'En gracia',  tone: 'gold' },
    revoked: { label: 'Sin acceso', tone: 'red' },
}

export const PROVIDER_LABEL: Record<string, string> = { stripe: 'Stripe', paypal: 'PayPal' }

export function statusMeta(map: Record<string, StatusMeta>, key?: string | null): StatusMeta {
    return (key && map[key]) || { label: key || '—', tone: 'neutral' }
}

/** Integer minor units (cents) → "US$ 49,00". Uses the currency's own number of decimals. */
export function formatMoney(minor: number | null | undefined, currency: string | null | undefined) {
    if (minor == null || !currency) return '—'
    const fmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: currency.trim() })
    const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2
    return fmt.format(minor / 10 ** digits)
}

const INTERVAL: Record<string, [string, string, string]> = {
    // [every 1, singular unit, plural unit]
    day:   ['Diario',  'día',  'días'],
    week:  ['Semanal', 'semana', 'semanas'],
    month: ['Mensual', 'mes',  'meses'],
    year:  ['Anual',   'año',  'años'],
}

export function formatInterval(interval?: string | null, count?: number | null) {
    if (!interval) return 'Pago único'
    const names = INTERVAL[interval]
    if (!names) return interval
    const n = count || 1
    return n === 1 ? names[0] : `Cada ${n} ${names[2]}`
}

export function formatBillingDate(date?: string | Date | null) {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatBillingDateTime(date?: string | Date | null) {
    if (!date) return '—'
    const d = new Date(date)
    return `${formatBillingDate(d)} ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
}

export const PAYMENT_STATUS: Record<string, StatusMeta> = {
    pending:   { label: 'Pendiente',   tone: 'neutral' },
    succeeded: { label: 'Exitoso',     tone: 'green' },
    failed:    { label: 'Fallido',     tone: 'red' },
    refunded:  { label: 'Reembolsado', tone: 'blue' },
    disputed:  { label: 'En disputa',  tone: 'red' },
}

/** Stripe invoice billing_reason → what the charge was for. */
export const BILLING_REASON: Record<string, string> = {
    subscription_create: 'Primer pago',
    subscription_cycle: 'Renovación',
    subscription_update: 'Cambio de plan',
    subscription_threshold: 'Cobro por umbral',
    manual: 'Cobro manual',
}

export const ROLE_ACTION: Record<string, string> = { grant: 'Rol otorgado', revoke: 'Rol removido' }

export const ROLE_ACTION_STATUS: Record<string, StatusMeta> = {
    pending:    { label: 'En cola',    tone: 'gold' },
    done:       { label: 'Hecho',      tone: 'green' },
    failed:     { label: 'Falló',      tone: 'red' },
    superseded: { label: 'Reemplazada', tone: 'outline' },
}

/** One line on what happens next with a subscription, most important fact first. */
export function subscriptionNextStep(s: any): { text: string; tone: 'red' | 'gold' | 'dim' } {
    if (s.revokedAt) return { text: `Revocada ${formatBillingDate(s.revokedAt)}${s.revokedReason ? ` · ${s.revokedReason}` : ''}`, tone: 'red' }
    if (s.endedAt) return { text: `Terminó ${formatBillingDate(s.endedAt)}`, tone: 'dim' }
    if (s.graceEndsAt) return { text: `Gracia hasta ${formatBillingDateTime(s.graceEndsAt)}`, tone: 'red' }
    if (s.cancelAtPeriodEnd || s.status === 'canceled') return { text: `No renueva · acceso hasta ${formatBillingDate(s.paidThrough)}`, tone: 'gold' }
    if (s.status === 'active' && s.currentPeriodEnd) return { text: `Renueva ${formatBillingDate(s.currentPeriodEnd)}`, tone: 'dim' }
    return { text: '—', tone: 'dim' }
}

/** "2885113b-…" → "2885113B": the short reference shown to staff. */
export function shortId(id?: string | null) {
    return id ? id.slice(0, 8).toUpperCase() : '—'
}

// ── Productos (catálogo de stc-billing) ─────────────────────────────────────

/**
 * "237.60" / "237,60" / "88" → 23760 / 23760 / 8800 cents. No floats and no
 * thousands separators: anything ambiguous returns null so the form can say so.
 */
export function parseMoneyInput(value: string | number | null | undefined): number | null {
    const m = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(String(value ?? '').trim())
    if (!m) return null
    const cents = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
    return cents > 0 ? cents : null
}

/** 23760 → "237.60", for prefilling an amount input. */
export function centsToInput(cents: number | null | undefined): string {
    if (cents == null) return ''
    return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

/** "Mensual", "3 meses", "Anual", "90 días", "De por vida", or the nickname. */
export function variantLabel(p: any): string {
    if (p?.nickname) return p.nickname
    if (p?.kind === 'one_time') return p.accessDurationDays ? `${p.accessDurationDays} días` : 'De por vida'
    const n = p?.intervalCount || 1
    if (p?.interval === 'month') return n === 1 ? 'Mensual' : `${n} meses`
    if (p?.interval === 'year') return n === 1 ? 'Anual' : `${n} años`
    return formatInterval(p?.interval, n)
}

/** "Cada mes", "Cada 3 meses", "Cada año": how often a variant charges. */
export function cadenceLabel(interval?: string | null, count?: number | null): string {
    const names = interval ? INTERVAL[interval] : undefined
    if (!names) return formatInterval(interval, count)
    const n = count || 1
    return n === 1 ? `Cada ${names[1]}` : `Cada ${n} ${names[2]}`
}

export const PRODUCT_KIND: Record<string, StatusMeta> = {
    recurring: { label: 'Suscripción', tone: 'blue' },
    one_time:  { label: 'Pago único',  tone: 'neutral' },
}

/** Product state for the list and the detail header. */
export function productStatus(s: any): StatusMeta {
    if (s?.archivedAt) return { label: 'Archivado', tone: 'outline' }
    if (s?.active) return { label: 'Publicado', tone: 'green' }
    return { label: 'Borrador', tone: 'neutral' }
}

/**
 * Variant state: on sale, draft, pending price change, or replaced. `pendingSwap`:
 * this is a new price waiting to replace one that is still current.
 */
export function variantStatus(p: any, pendingSwap = false): StatusMeta {
    if (p?.retiredAt) return { label: 'Reemplazada', tone: 'outline' }
    if (p?.active) return { label: 'A la venta', tone: 'green' }
    if (pendingSwap) return { label: 'Cambio pendiente', tone: 'gold' }
    return { label: 'Borrador', tone: 'neutral' }
}

/**
 * Provider failures in a stc-billing sync result ({ stripe, paypal }, or the
 * product sync's { service, prices }). null when everything reached the providers.
 */
export function syncProblems(sync: any): string | null {
    if (!sync || typeof sync !== 'object') return null
    const out: string[] = []
    const visit = (r: any) => {
        for (const k of ['stripe', 'paypal'] as const) {
            const v = r?.[k]
            if (typeof v === 'string' && v.startsWith('error')) out.push(`${PROVIDER_LABEL[k]}: ${v.slice(7)}`)
        }
    }
    if (sync.service || sync.prices) {
        visit(sync.service)
        for (const r of Object.values(sync.prices ?? {})) visit(r)
    } else visit(sync)
    return out.length ? [...new Set(out)].join(' · ') : null
}

const MONTHS: Record<string, number> = { month: 1, year: 12 }

/**
 * Preview only, while staff type an amount. stc-billing (shared/savings.ts) computes
 * the real tag the same way: per month against the shortest variant, rounded down.
 */
export function previewSavings(base: { amount: number; months: number } | null, amount: number | null, months: number | null) {
    if (!base || !amount || !months || months <= base.months) return null
    const reference = base.amount * months
    const saved = reference - amount * base.months
    const percent = saved > 0 ? Math.floor((saved * 100) / reference) : 0
    return percent > 0 ? percent : null
}

/** Months in one billing cycle of a recurring variant (null for day/week/one-time). */
export function variantMonths(p: { kind?: string; interval?: string | null; intervalCount?: number | null }): number | null {
    if (p.kind !== 'recurring' || !p.interval || !MONTHS[p.interval]) return null
    return MONTHS[p.interval]! * (p.intervalCount || 1)
}
