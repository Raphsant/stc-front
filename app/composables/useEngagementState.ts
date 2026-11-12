import { getEngagementState } from '#shared/engagement'

export { getEngagementState }
export type { EngagementState, EngagementStateInfo } from '#shared/engagement'

export function formatRelativeTime(date?: Date | string | null): string {
    if (!date) return 'never'
    const diffMs = Date.now() - new Date(date).getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays < 1) {
        const hours = Math.floor(diffMs / (1000 * 60 * 60))
        if (hours < 1) return 'ahora mismo'
        return hours === 1 ? 'hace 1 hora' : `hace ${hours} horas`
    }
    if (diffDays === 1) return 'ayer'
    if (diffDays < 30) return `hace ${diffDays} días`
    if (diffDays < 365) {
        const months = Math.floor(diffDays / 30)
        return months === 1 ? 'hace 1 mes' : `hace ${months} meses`
    }
    const years = Math.floor(diffDays / 365)
    return years === 1 ? 'hace 1 año' : `hace ${years} años`
}

export const useEngagementState = () => ({
    getEngagementState,
    formatRelativeTime,
})
