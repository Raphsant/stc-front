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
