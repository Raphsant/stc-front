export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ status: 401, statusText: 'Unauthorized' })
  }
  return session.user
})
