// Engagement state from the most recent message or meeting. Pure, so the
// report endpoint and the client agree on the same thresholds.
export type EngagementState = 'active' | 'slipping' | 'inactive' | 'dormant'

export interface EngagementStateInfo {
    state: EngagementState
    label: string
    color: 'success' | 'warning' | 'error' | 'neutral'
    daysSince: number | null
}

export const ENGAGEMENT_STATES: EngagementState[] = ['active', 'slipping', 'inactive', 'dormant']

export function getEngagementState(
    lastMessageAt?: Date | string | null,
    lastMeetingAt?: Date | string | null,
    now: number = Date.now(),
): EngagementStateInfo {
    const msgTime = lastMessageAt ? new Date(lastMessageAt).getTime() : 0
    const mtgTime = lastMeetingAt ? new Date(lastMeetingAt).getTime() : 0
    const lastActive = Math.max(msgTime, mtgTime)

    if (!lastActive) {
        return { state: 'dormant', label: 'Inactivo', color: 'neutral', daysSince: null }
    }

    const daysSince = Math.floor((now - lastActive) / (1000 * 60 * 60 * 24))

    if (daysSince <= 7) return { state: 'active', label: 'Activo', color: 'success', daysSince }
    if (daysSince <= 30) return { state: 'slipping', label: 'Ausente', color: 'warning', daysSince }
    if (daysSince <= 90) return { state: 'inactive', label: 'Inactivo', color: 'error', daysSince }
    return { state: 'dormant', label: 'Dormido', color: 'neutral', daysSince }
}
