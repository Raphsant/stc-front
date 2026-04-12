export default defineEventHandler(async (event) => {
  const path = event.path

  // Only protect /api/* routes
  if (!path.startsWith('/api/')) return

  // Allow auth endpoints and bot endpoints through
  if (path.startsWith('/api/auth/') || path.startsWith('/api/bot/' || path.startsWith('/api/logs/'))) return

  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ status: 401, statusText: 'Unauthorized' })
  }
})
