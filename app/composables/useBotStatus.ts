// composables/useBotStatus.ts
export const useBotStatus = () => {
    return useAsyncData(
        'bot-status', // unique key
        () => $fetch('https://stc.snuuy.com/health'),
        {
            lazy: true,
            getCachedData(key, nuxtApp) {
                // return cached data if it exists, otherwise refetch
                return nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
            }
        }
    )
}
