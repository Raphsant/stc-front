// The stc-front staff accounts, for /staff. Superadmin only.
export default defineEventHandler(async (event) => {
    await requireSuperAdmin(event)
    return { users: await listStaffAccounts() }
})
