export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const filter: any = {}
  
  if (query.userId) {
    filter.participants = query.userId
  }

  try {
    let queryBuilder = ZoomLog.find(filter).sort({ occurredAt: -1 })
    
    if (query.limit) {
      queryBuilder = queryBuilder.limit(Number(query.limit))
    }

    const meetings = await queryBuilder.populate('participants')
    return meetings
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    })
  }
})
