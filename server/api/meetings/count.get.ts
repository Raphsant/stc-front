export default defineEventHandler(async (_event) => {
    try{
        const count = await ZoomLog.countDocuments()
        return {count}

    }catch (e: any) {
        throw createError({
            status: 500,
            statusText: e.message,
        })
    }
})
