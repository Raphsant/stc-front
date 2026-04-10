export default defineEventHandler(async (event) => {
  const id = event.context.params?.id
  try {
    const meeting = await ZoomLog.findById(id).populate('participants')
    if (!meeting) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Meeting not found',
      })
    }
    return meeting
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    })
  }
})
