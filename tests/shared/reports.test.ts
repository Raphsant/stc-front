import { describe, it, expect } from 'vitest'
import {
    buildReportTitle,
    classifyTier,
    daysLeft,
    defaultFilters,
    describeFilters,
    expiryBucket,
    matchesExpiry,
    parseFilters,
    resolveMembership,
    serializeFilters,
    sortRows,
    type ReportMembership,
} from '#shared/reports'

// Wednesday 2026-11-11, mid-day UTC
const NOW = Date.UTC(2026, 10, 11, 15, 0, 0)

function expiring(date: string | null): ReportMembership {
    return { source: 'cf', status: 'active', expiresAt: date, daysLeft: daysLeft(date, NOW), productName: null }
}

describe('classifyTier', () => {
    it('groups dotted roles with their family and keeps the exact role', () => {
        expect(classifyTier(['@everyone', 'Delta.'])).toEqual({ tier: 'delta', tierRole: 'Delta.' })
        expect(classifyTier(['Alpha', 'Delta'])).toEqual({ tier: 'alpha', tierRole: 'Alpha' })
        expect(classifyTier(['@everyone'])).toEqual({ tier: 'none', tierRole: null })
    })

    it('counts a paused Alpha without the Discord role as alpha', () => {
        expect(classifyTier(['Delta'], 'paused').tier).toBe('alpha')
        expect(classifyTier(['Delta'], 'removed').tier).toBe('delta')
    })
})

describe('resolveMembership', () => {
    const cf = { status: 'active', expiresAt: '2026-12-01T00:00:00Z', productName: 'Delta', syncedAt: '2026-11-11T09:30:00Z' }

    it('prefers an active or paused Alpha doc over ClickFunnels', () => {
        const m = resolveMembership({ status: 'paused', expiresAt: '2027-01-10T00:00:00Z' }, cf, NOW)
        expect(m).toMatchObject({ source: 'alpha', status: 'paused', daysLeft: 60 })
    })

    it('falls back to ClickFunnels, then to unknown', () => {
        expect(resolveMembership({ status: 'removed', expiresAt: null }, cf, NOW)).toMatchObject({ source: 'cf', daysLeft: 20 })
        expect(resolveMembership(null, { status: null, syncedAt: null }, NOW)).toMatchObject({ source: null, status: 'none', daysLeft: null })
    })

    it('maps unknown ClickFunnels statuses to other', () => {
        expect(resolveMembership(null, { ...cf, status: 'completed' }, NOW).status).toBe('other')
    })
})

describe('expiry', () => {
    it('counts whole UTC days and buckets them disjointly', () => {
        expect(daysLeft('2026-11-11T23:59:00Z', NOW)).toBe(0)
        expect(daysLeft('2026-11-10T23:59:00Z', NOW)).toBe(-1)
        expect([null, -1, 0, 7, 8, 30, 31, 60, 61, 90, 91].map(expiryBucket)).toEqual(
            ['none', 'expired', 'd7', 'd7', 'd30', 'd30', 'd60', 'd60', 'd90', 'd90', 'later'],
        )
    })

    it('week runs today through Sunday, month through the last day', () => {
        const f = (expiry: any) => ({ expiry, expFrom: '', expTo: '' })
        expect(matchesExpiry(expiring('2026-11-15T10:00:00Z'), f('week'), NOW)).toBe(true) // Sunday
        expect(matchesExpiry(expiring('2026-11-16T10:00:00Z'), f('week'), NOW)).toBe(false) // next Monday
        expect(matchesExpiry(expiring('2026-11-10T10:00:00Z'), f('week'), NOW)).toBe(false) // already past
        expect(matchesExpiry(expiring('2026-11-30T23:00:00Z'), f('month'), NOW)).toBe(true)
        expect(matchesExpiry(expiring('2026-12-01T00:00:00Z'), f('month'), NOW)).toBe(false)
    })

    it('handles nextN, expired, none and range', () => {
        const f = (expiry: any, expFrom = '', expTo = '') => ({ expiry, expFrom, expTo })
        expect(matchesExpiry(expiring('2026-12-11T00:00:00Z'), f('next30'), NOW)).toBe(true)
        expect(matchesExpiry(expiring('2026-12-12T00:00:00Z'), f('next30'), NOW)).toBe(false)
        expect(matchesExpiry(expiring('2026-11-01T00:00:00Z'), f('expired'), NOW)).toBe(true)
        expect(matchesExpiry(expiring('2026-11-01T00:00:00Z'), f('next90'), NOW)).toBe(false)
        expect(matchesExpiry(expiring(null), f('none'), NOW)).toBe(true)
        expect(matchesExpiry(expiring(null), f('next30'), NOW)).toBe(false)
        expect(matchesExpiry(expiring('2026-12-05T08:00:00Z'), f('range', '2026-12-01', '2026-12-05'), NOW)).toBe(true)
        expect(matchesExpiry(expiring('2026-12-06T08:00:00Z'), f('range', '2026-12-01', '2026-12-05'), NOW)).toBe(false)
    })
})

describe('parseFilters / serializeFilters', () => {
    it('round-trips and omits defaults', () => {
        expect(serializeFilters(defaultFilters())).toEqual({})
        const q = { country: 'ES', region: 'B', city: 'barcelona', tier: 'delta', expiry: 'next30', sortBy: 'expiresAt' }
        expect(serializeFilters(parseFilters(q))).toEqual(q)
    })

    it('drops invalid values and dependent fields', () => {
        const f = parseFilters({
            tier: 'delta,bogus,alpha', member: 'nope', region: 'B', city: 'x',
            expiry: 'next30', expFrom: '2026-01-01', msgMin: '-3', joinedFrom: '2026-13-40',
        })
        expect(f.tier).toEqual(['alpha', 'delta'])
        expect(f.member).toBe('active')
        expect(f.region).toBe('') // no country
        expect(f.city).toBe('')
        expect(f.expFrom).toBe('') // only kept for expiry=range
        expect(f.msgMin).toBeNull()
        expect(f.joinedFrom).toBe('')
    })
})

describe('titles and chips', () => {
    it('builds the example title', () => {
        const f = parseFilters({ country: 'ES', region: 'B', city: 'barcelona', tier: 'delta', expiry: 'next30' })
        expect(buildReportTitle(f, { region: 'Barcelona', city: 'Barcelona' }))
            .toBe('Usuarios Delta en Barcelona, España · vencen en 30 días')
        expect(buildReportTitle(defaultFilters())).toBe('Usuarios')
    })

    it('gives each active filter a chip whose patch clears it', () => {
        const f = parseFilters({ tier: 'alpha,delta', contacted: 'no', country: 'none' })
        const chips = describeFilters(f)
        expect(chips.map(c => c.label)).toEqual(['Sin ubicación', 'Alpha', 'Delta', 'Nunca contactados'])
        expect(chips[1]!.clear).toEqual({ tier: ['delta'] })
    })
})

describe('sortRows', () => {
    it('keeps rows without a value last in both directions', () => {
        const row = (username: string, expiresAt: string | null) => ({ username, membership: { expiresAt } }) as any
        const rows = [row('a', null), row('b', '2026-12-01'), row('c', '2026-11-20')]
        expect(sortRows(rows, 'expiresAt', 'asc').map(r => r.username)).toEqual(['c', 'b', 'a'])
        expect(sortRows(rows, 'expiresAt', 'desc').map(r => r.username)).toEqual(['b', 'c', 'a'])
    })
})
