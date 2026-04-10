export default defineEventHandler(async (event) => {
  try {
    const data = await $fetch('http://localhost:3001/webhooks/discord-info')
    return data
  } catch (error: any) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Could not fetch Discord information',
    })
  }
})
