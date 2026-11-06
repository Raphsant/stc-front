// Read-only ClickFunnels 2.0 client for the contact details shown on a
// Discord user's profile. Mirrors the calls stcbot makes (same base URL,
// token and workspace).

const CF_BASE = 'https://eduardobricenosteam309bd.myclickfunnels.com/api/v2'

export interface CfAddress {
    streetOne: string | null
    streetTwo: string | null
    city: string | null
    region: string | null
    postalCode: string | null
    country: string | null
}

export interface CfContactDetails {
    contactId: number
    fullName: string | null
    email: string | null
    phone: string | null
    address: CfAddress | null
}

export class CfNotFoundError extends Error {}

function readConfig() {
    const cfg = useRuntimeConfig()
    return {
        token: (cfg.cfToken as string) || '',
        workspaceId: (cfg.cfWorkspaceId as string) || '',
    }
}

async function cfGet(path: string): Promise<any> {
    const { token } = readConfig()
    if (!token) throw new Error('CF2_TOKEN is not configured')
    const res = await fetch(`${CF_BASE}${path}`, {
        headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    })
    if (res.status === 404) throw new CfNotFoundError(`CF 404 on ${path}`)
    if (!res.ok) throw new Error(`CF ${res.status} on ${path}`)
    return res.json()
}

const clean = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

// CF contacts have no address of their own — it lives on each order.
// Takes the most recent order that has one, preferring billing over shipping.
export function pickAddress(orders: any[]): CfAddress | null {
    const sorted = [...(orders || [])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    for (const o of sorted) {
        for (const prefix of ['billing_address_', 'shipping_address_']) {
            const addr: CfAddress = {
                streetOne: clean(o[`${prefix}street_one`]),
                streetTwo: clean(o[`${prefix}street_two`]),
                city: clean(o[`${prefix}city`]),
                region: clean(o[`${prefix}region`]),
                postalCode: clean(o[`${prefix}postal_code`]),
                country: clean(o[`${prefix}country`]),
            }
            if (addr.streetOne || addr.city) return addr
        }
    }
    return null
}

export function normalizeContact(contact: any, orders: any[]): CfContactDetails {
    const fullName = [clean(contact.first_name), clean(contact.last_name)].filter(Boolean).join(' ')
    return {
        contactId: contact.id,
        fullName: fullName || null,
        email: clean(contact.email_address),
        phone: clean(contact.phone_number),
        address: pickAddress(orders),
    }
}

export async function getCfContactDetails(contactId: number): Promise<CfContactDetails> {
    const { workspaceId } = readConfig()
    const [contact, orders] = await Promise.all([
        cfGet(`/contacts/${contactId}`),
        // Address is optional — a failed orders call shouldn't hide the rest.
        cfGet(`/workspaces/${workspaceId}/orders?filter[contact_id]=${contactId}`).catch(() => []),
    ])
    return normalizeContact(contact, orders)
}
