export default defineEventHandler(async (event) => {
  try {
    const data = await $fetch('https://stc.snuuy.com/webhooks/discord-info')
    return data
  } catch (error: any) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Could not fetch Discord information',
    })
  }
})
