// Display helpers for the metrics page (/billing/metrics). Labels and formatting
// only: every number and every definition comes from stc-billing, and who may see
// what is decided in shared/permissions.ts and enforced on the server.

import type { StatusMeta } from './billing'

/** stc-billing counts days and months in this zone. */
export const METRICS_TIME_ZONE = 'America/Chicago'

/** Integer cents → "US$ 4.900,00"; "—" when there is nothing (or it was left out for this role). */
export function formatUsd(cents: number | null | undefined): string {
    if (cents == null) return '—'
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

/** Whole dollars for big tiles: 35000 → "US$ 350". */
export function formatUsdShort(cents: number | null | undefined): string {
    if (cents == null) return '—'
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.round(cents / 100))
}

/** A movement with its sign: 4900 → "+US$ 49,00", -4900 → "−US$ 49,00", 0 → "US$ 0,00". */
export function formatUsdSigned(cents: number | null | undefined): string {
    if (cents == null) return '—'
    if (cents === 0) return formatUsd(0)
    return `${cents > 0 ? '+' : '−'}${formatUsd(Math.abs(cents))}`
}

/** A rate from stc-billing (0.375) → "37,5 %"; null (nothing to divide by) → "—". */
export function formatRate(rate: number | null | undefined): string {
    if (rate == null) return '—'
    return `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(rate * 100)} %`
}

/** "1 suscripción", "3 suscripciones", and "—" for a count that is not there. */
export function countOf(n: number | null | undefined, one: string, many: string): string {
    return n == null ? '—' : `${formatCount(n)} ${n === 1 ? one : many}`
}

export function formatCount(n: number | null | undefined): string {
    return n == null ? '—' : new Intl.NumberFormat('es-ES').format(n)
}

/** The Chicago calendar day of an instant, "YYYY-MM-DD". */
export function chicagoDay(instant: Date | number = Date.now()): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: METRICS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant))
}

export function addDaysTo(day: string, n: number): string {
    const [y, m, d] = day.split('-').map(Number) as [number, number, number]
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export function addMonthsTo(month: string, n: number): string {
    const [y, m] = month.split('-').map(Number) as [number, number]
    return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "2026-11" → "noviembre 2026". */
export function monthLabel(month: string): string {
    const [y, m] = month.split('-').map(Number)
    return MONTHS[(m ?? 1) - 1] ? `${MONTHS[(m ?? 1) - 1]} ${y}` : month
}

/** "2026-11-20" → "20 nov"; "2026-11" → "nov 2026": the label under a chart point. */
export function periodLabel(period: string): string {
    const [y, m, d] = period.split('-').map(Number)
    const short = (MONTHS[(m ?? 1) - 1] ?? '').slice(0, 3)
    return d ? `${d} ${short}` : `${short} ${y}`
}

/** The current month and the eleven before it, newest first. */
export function recentMonths(today: string = chicagoDay(), count = 12): Array<{ value: string; label: string }> {
    const current = today.slice(0, 7)
    return Array.from({ length: count }, (_, i) => {
        const value = addMonthsTo(current, -i)
        return { value, label: monthLabel(value) }
    })
}

export interface RangePreset { key: string; label: string; from: string; to: string; bucket: 'day' | 'month' }

/** The date ranges offered on the page, as Chicago days (both ends included). */
export function rangePresets(today: string = chicagoDay()): RangePreset[] {
    const month = today.slice(0, 7)
    return [
        { key: 'month', label: 'Este mes', from: `${month}-01`, to: today, bucket: 'day' },
        { key: '30d', label: '30 días', from: addDaysTo(today, -29), to: today, bucket: 'day' },
        { key: '90d', label: '90 días', from: addDaysTo(today, -89), to: today, bucket: 'day' },
        { key: '12m', label: '12 meses', from: `${addMonthsTo(month, -11)}-01`, to: today, bucket: 'month' },
    ]
}

// ── Labels ──────────────────────────────────────────────────────────────────

/** What moved MRR in a period. An imported member's first real charge is "migrado", not a new sale. */
export const MOVEMENT: Record<string, StatusMeta & { sign: 1 | -1 }> = {
    new:         { label: 'Nuevo',       tone: 'green', sign: 1 },
    migrated:    { label: 'Migrado',     tone: 'blue',  sign: 1 },
    reactivated: { label: 'Reactivado',  tone: 'gold',  sign: 1 },
    churned:     { label: 'Bajas',       tone: 'red',   sign: -1 },
}
export const MOVEMENT_KEYS = ['new', 'migrated', 'reactivated', 'churned'] as const

export const CHURN_KIND: Record<string, StatusMeta & { help: string }> = {
    voluntary:   { label: 'Voluntaria',   tone: 'gold', help: 'Canceló y terminó el periodo pagado' },
    involuntary: { label: 'Involuntaria', tone: 'red',  help: 'Falló el cobro y se agotó la gracia' },
    revoked:     { label: 'Revocada',     tone: 'blue', help: 'Reembolso total o contracargo' },
}
export const CHURN_KEYS = ['voluntary', 'involuntary', 'revoked'] as const

export const REVENUE_KIND: Record<string, string> = {
    first: 'Primer pago',
    renewal: 'Renovación',
    migrated: 'Migrado de Payments AI',
    one_time: 'Pago único',
}

export const FAILURE_OUTCOME: Record<string, StatusMeta> = {
    recovered_in_grace:    { label: 'Recuperado en gracia', tone: 'green' },
    recovered_after_grace: { label: 'Recuperado tarde',     tone: 'gold' },
    lost:                  { label: 'Perdido',              tone: 'red' },
    open:                  { label: 'Abierto',              tone: 'neutral' },
}

/** The bank's decline reason, in words staff can pass on. Unknown codes are shown as they come. */
const FAILURE_CODE: Record<string, string> = {
    insufficient_funds: 'Fondos insuficientes',
    expired_card: 'Tarjeta vencida',
    generic_decline: 'Rechazo genérico del banco',
    do_not_honor: 'El banco no autorizó',
    card_declined: 'Tarjeta rechazada',
    authentication_required: 'Requiere confirmación (3-D Secure)',
    incorrect_cvc: 'CVC incorrecto',
    lost_card: 'Tarjeta reportada perdida',
    stolen_card: 'Tarjeta reportada robada',
    processing_error: 'Error del procesador',
    card_velocity_exceeded: 'Límite de la tarjeta excedido',
    transaction_not_allowed: 'Transacción no permitida',
    unknown: 'Sin motivo registrado',
}
export function failureCodeLabel(code?: string | null): string {
    if (!code) return FAILURE_CODE.unknown!
    return FAILURE_CODE[code] ?? code
}

/** A signup source or campaign as stc-billing groups it. */
export function sourceLabel(key: string): string {
    if (key === 'direct') return 'Directo'
    if (key === '(none)') return 'Sin dato'
    if (key === '(no order)') return 'Sin compra iniciada'
    if (key.startsWith('affiliate:')) return `Afiliado ${key.slice('affiliate:'.length)}`
    return key
}

export const SIGNUP_GROUP: Array<{ key: string; label: string }> = [
    { key: 'source', label: 'Fuente' },
    { key: 'medium', label: 'Medio' },
    { key: 'campaign', label: 'Campaña' },
    { key: 'affiliate', label: 'Afiliado' },
]

export const RECON_SCOPE: Record<string, string> = {
    subscriptions: 'Suscripciones',
    mrr: 'MRR por suscripción',
    revenue: 'Pagos, reembolsos y disputas del día',
    failed_invoices: 'Facturas fallidas abiertas',
    repair: 'Reparación automática',
}

export const RECON_STATUS: Record<string, StatusMeta> = {
    ok:       { label: 'Coincide',     tone: 'green' },
    mismatch: { label: 'Diferencias',  tone: 'red' },
    error:    { label: 'No se pudo comprobar', tone: 'gold' },
}

/** What a mismatch from the checks against Stripe means. */
const MISMATCH_KIND: Record<string, string> = {
    status: 'Estado distinto',
    period_end: 'Fin de periodo distinto',
    cancel_at_period_end: 'Cancelación programada distinta',
    paid_through: 'Stripe cobró un periodo que no tenemos',
    missing: 'Suscripción nuestra que no tenemos registrada',
    mrr: 'MRR distinto',
    mrr_unpriced: 'No se pudo calcular el MRR en Stripe',
    payment_missing: 'Pago en Stripe que no tenemos',
    payment_amount: 'Monto de pago distinto',
    payment_not_at_stripe: 'Pago nuestro que Stripe no muestra como pagado',
    payment_other_day: 'Pago registrado en otro día',
    refund_missing: 'Reembolso que no tenemos',
    refund: 'Reembolso distinto',
    dispute_missing: 'Disputa que no tenemos',
    dispute: 'Disputa con otro estado',
    failure_missing: 'Factura fallida que no tenemos',
    failure_not_open_at_stripe: 'Fallo abierto aquí y cerrado en Stripe',
    error: 'Error al comprobar',
}
export function mismatchLabel(kind?: string | null): string {
    return (kind && MISMATCH_KIND[kind]) || kind || '—'
}

/** A mismatch value for display: dollars for the kinds that compare amounts, plain text otherwise. */
export function mismatchValue(kind: string, value: unknown): string {
    if (value == null) return '—'
    if (typeof value === 'number' && /^(mrr|payment_missing|payment_amount|payment_not_at_stripe|refund_missing)$/.test(kind)) return formatUsd(value)
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
}

/** MRR at the end of each bucket, in dollars, for StcChart. */
export function mrrChartPoints(buckets: Array<{ period: string; end: number }> | null | undefined): Array<{ label: string; value: number }> {
    return (buckets ?? []).map((b) => ({ label: periodLabel(b.period), value: Math.round(b.end / 100) }))
}

/** "hace 3 min", for the "as of" line under a report. */
export function asOfLabel(asOf?: string | null, now: number = Date.now()): string {
    if (!asOf) return ''
    const minutes = Math.max(0, Math.round((now - new Date(asOf).getTime()) / 60_000))
    if (minutes < 1) return 'Calculado ahora'
    if (minutes < 60) return `Calculado hace ${minutes} min`
    return `Calculado ${new Date(asOf).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}`
}
