export default defineEventHandler(async (event) => {
  try {
    // Calling the bot's health endpoint on port 3001
    const status = await $fetch('https://snuuy.com/health')
    return status
  } catch (error: any) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Bot is currently unreachable',
    })
  }
})
