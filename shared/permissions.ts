// Who may see which metrics. Pure, used by the server routes (which enforce it)
// and by the pages (which only hide what would be refused anyway).
//
// stc-billing has one shared admin key and cannot tell one staff member from
// another, so every check on its metrics happens here, in stc-front, before the
// request is forwarded.
//
//   metrics:counts   subscriber counts, churn and renewal rates, signups
//   metrics:money    anything in dollars: MRR, revenue, amounts
//   metrics:members  drill-down lists with names and emails (open failed payments)
//   metrics:export   CSV export
//   metrics:admin    reconciliation with Stripe
//
// | role       | counts | money | members | export | admin |
// | superadmin |  yes   |  yes  |   yes   |  yes   |  yes  |   the owner
// | finance    |  yes   |  yes  |   yes   |  yes   |  no   |
// | admin      |  yes   |  no   |   yes   |  no    |  no   |   support
//
// A role that is missing or unknown gets nothing.

export type MetricScope = 'metrics:counts' | 'metrics:money' | 'metrics:members' | 'metrics:export' | 'metrics:admin'
export type StaffRole = 'superadmin' | 'finance' | 'admin'

export const STAFF_ROLES: readonly StaffRole[] = ['admin', 'finance', 'superadmin']

export const ROLE_LABEL: Record<StaffRole, string> = {
    superadmin: 'Superadmin',
    finance: 'Finanzas',
    admin: 'Admin',
}

const ALL: readonly MetricScope[] = ['metrics:counts', 'metrics:money', 'metrics:members', 'metrics:export', 'metrics:admin']

export const ROLE_SCOPES: Record<StaffRole, readonly MetricScope[]> = {
    superadmin: ALL,
    finance: ['metrics:counts', 'metrics:money', 'metrics:members', 'metrics:export'],
    admin: ['metrics:counts', 'metrics:members'],
}

export function scopesOf(role: unknown): readonly MetricScope[] {
    return typeof role === 'string' && Object.hasOwn(ROLE_SCOPES, role) ? ROLE_SCOPES[role as StaffRole] : []
}

/** `user` is the session user ({ role }); anything else has no scope. */
export function hasScope(user: unknown, scope: MetricScope): boolean {
    return scopesOf((user as { role?: unknown } | null | undefined)?.role).includes(scope)
}

export function roleLabel(role: unknown): string {
    return typeof role === 'string' && Object.hasOwn(ROLE_LABEL, role) ? ROLE_LABEL[role as StaffRole] : 'Admin'
}
