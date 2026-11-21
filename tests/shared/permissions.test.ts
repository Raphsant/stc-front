import { describe, expect, it } from 'vitest'
import { hasScope, ROLE_SCOPES, roleLabel, scopesOf, STAFF_ROLES } from '#shared/permissions'

describe('metric scopes', () => {
    it('gives the owner everything', () => {
        expect(scopesOf('superadmin')).toEqual(['metrics:counts', 'metrics:money', 'metrics:members', 'metrics:export', 'metrics:admin'])
    })

    it('gives finance the money and the export, not the reconciliation', () => {
        const u = { role: 'finance' }
        expect(hasScope(u, 'metrics:counts')).toBe(true)
        expect(hasScope(u, 'metrics:money')).toBe(true)
        expect(hasScope(u, 'metrics:members')).toBe(true)
        expect(hasScope(u, 'metrics:export')).toBe(true)
        expect(hasScope(u, 'metrics:admin')).toBe(false)
    })

    it('gives support counts and member lists, and nothing in dollars', () => {
        const u = { role: 'admin' }
        expect(hasScope(u, 'metrics:counts')).toBe(true)
        expect(hasScope(u, 'metrics:members')).toBe(true)
        expect(hasScope(u, 'metrics:money')).toBe(false)
        expect(hasScope(u, 'metrics:export')).toBe(false)
        expect(hasScope(u, 'metrics:admin')).toBe(false)
    })

    it('gives nothing to a missing or unknown role', () => {
        for (const user of [null, undefined, {}, { role: null }, { role: 'owner' }, { role: 'constructor' }, { role: 'toString' }, 'superadmin']) {
            expect(scopesOf((user as any)?.role)).toEqual([])
            expect(hasScope(user, 'metrics:counts')).toBe(false)
            expect(hasScope(user, 'metrics:money')).toBe(false)
        }
    })

    it('covers every role the user model allows', () => {
        expect([...STAFF_ROLES].sort()).toEqual(Object.keys(ROLE_SCOPES).sort())
        expect(roleLabel('finance')).toBe('Finanzas')
        expect(roleLabel('superadmin')).toBe('Superadmin')
        expect(roleLabel(undefined)).toBe('Admin')
    })
})
