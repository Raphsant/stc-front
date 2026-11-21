export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ status: 401, statusText: 'Unauthorized' })
  }
  // This route skips the auth middleware, so bring the role up to date here.
  return await syncStaffSession(event)
})
