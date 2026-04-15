export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = Number(query.limit) || 200

  try {
    const logs = await DashBoardLog.find()
      .sort({ occurredAt: -1 })
      .limit(limit)
      .populate('userId')
      .populate('zoomLogId')

    return logs
  } catch (error: any) {
    throw createError({
      status: 500,
      statusText: error.message,
    })
  }
})
