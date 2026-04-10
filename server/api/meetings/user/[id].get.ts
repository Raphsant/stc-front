export default defineEventHandler(async (event) => {
    const userId = getRouterParam(event, 'id')
    try{
        //@ts-ignore
        return await ZoomLog.find({participants: userId}).sort({occurredAt: -1})
    }catch (e: any) {
        throw createError({
            status: 500,
            statusText: 'Error fetching meetings',
        })
    }
})
