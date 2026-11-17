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
