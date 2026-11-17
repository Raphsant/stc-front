// Server-side client for stc-billing's staff API (/api/admin/**).
// The API key never reaches the browser: pages call /api/billing/*, which call this.

type Query = Record<string, string | number | undefined>

export async function billingGet<T = unknown>(event: any, path: string, query: Query = {}): Promise<T> {
    const cfg = useRuntimeConfig()
    const base = String(cfg.billingApiUrl || '').replace(/\/+$/, '')
    const key = String(cfg.billingAdminApiKey || '')
    if (!base || !key) {
        throw createError({
            statusCode: 503,
            statusMessage: 'Facturación no configurada: faltan NUXT_BILLING_API_URL o NUXT_BILLING_ADMIN_API_KEY',
        })
    }

    const { user } = await getUserSession(event)
    try {
        return await $fetch<T>(`/api/admin${path}`, {
            baseURL: base,
            query,
            headers: {
                'x-api-key': key,
                // stc-billing records this in its audit log.
                'x-staff-user': String((user as any)?.username || 'stc-front'),
            },
            timeout: 10000,
        })
    } catch (e: any) {
        const status = e?.response?.status
        throw createError({
            statusCode: status === 401 || status === 503 ? 502 : status || 502,
            statusMessage: e?.data?.message || `stc-billing no respondió (${status ?? e?.message ?? 'error'})`,
        })
    }
}

/** limit/offset/status from the page, whitelisted so nothing else is forwarded. */
export function billingListQuery(event: any, statuses: readonly string[]): Query {
    const q = getQuery(event)
    const limit = Math.min(Math.max(Number(q.limit) || 25, 1), 200)
    const offset = Math.max(Number(q.offset) || 0, 0)
    const status = statuses.includes(String(q.status)) ? String(q.status) : undefined
    return { limit, offset, status }
}
