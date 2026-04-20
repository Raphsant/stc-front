export type EngagementState = 'active' | 'slipping' | 'inactive' | 'dormant'

export interface EngagementStateInfo {
    state: EngagementState
    label: string
    color: 'success' | 'warning' | 'error' | 'neutral'
    daysSince: number | null
}

export function getEngagementState(
    lastMessageAt?: Date | string | null,
    lastMeetingAt?: Date | string | null,
): EngagementStateInfo {
    const msgTime = lastMessageAt ? new Date(lastMessageAt).getTime() : 0
    const mtgTime = lastMeetingAt ? new Date(lastMeetingAt).getTime() : 0
    const lastActive = Math.max(msgTime, mtgTime)

    if (!lastActive) {
        return { state: 'dormant', label: 'Inactivo', color: 'neutral', daysSince: null }
    }

    const daysSince = Math.floor((Date.now() - lastActive) / (1000 * 60 * 60 * 24))

    if (daysSince <= 7) return { state: 'active', label: 'Activo', color: 'success', daysSince }
    if (daysSince <= 30) return { state: 'slipping', label: 'Bajando', color: 'warning', daysSince }
    if (daysSince <= 90) return { state: 'inactive', label: 'Inactivo', color: 'error', daysSince }
    return { state: 'dormant', label: 'Dormido', color: 'neutral', daysSince }
}

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
