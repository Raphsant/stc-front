export default defineEventHandler(async (event) => {
  try {
    // Calling the bot's health endpoint on port 3001
    const botStatus = await $fetch('https://snuuy.com/health')
    return botStatus
  } catch (error: any) {
    throw createError({
      status: 503,
      statusText: 'Bot is currently unreachable',
    })
  }
})
