import {
    ACTION_TYPES,
    ALPHA_FIT_SIGNALS,
    BEST_FIT_CATEGORIES,
    COMPARISON_SENTIMENTS,
    CONVERSATION_CHANNELS,
    DELTA_SCHEMA_VERSION,
    PRIORITIES,
    type ActionType,
    type AlphaFitSignal,
    type BestFitCategory,
    type ComparisonSentiment,
    type ConversationChannel,
    type DeltaAnalysisResult,
    type Priority,
} from '#shared/deltaAnalysis'

// Defensive normalization of the model's JSON.
//
// The API already enforces the json_schema, so this is belt-and-braces: it
// guarantees the shape the DB, aggregations and UI depend on even if the
// schema is relaxed later or a legacy/hand-written payload shows up. Kept in
// its own module (no Anthropic client) so it can be unit-tested directly.

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
    return typeof value === 'string' && (allowed as readonly string[]).includes(value)
        ? value as T
        : fallback
}

/** Trimmed string, or null when absent/blank. */
function nullableString(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
}

function plainString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : ''
}

function stringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value
        .filter((v): v is string => typeof v === 'string')
        .map(v => v.trim())
        .filter(v => v.length > 0)
}

/** Keeps an ISO-ish date string only when it actually parses. */
function isoDateOrNull(value: unknown): string | null {
    const raw = nullableString(value)
    if (!raw) return null
    return Number.isNaN(Date.parse(raw)) ? null : raw
}

export function normalizeDeltaResult(raw: any): DeltaAnalysisResult {
    const source = (raw && typeof raw === 'object') ? raw : {}
    const followUpSource = (source.follow_up && typeof source.follow_up === 'object')
        ? source.follow_up
        : {}

    const bestFit = pickEnum<BestFitCategory>(source.best_fit_category, BEST_FIT_CATEGORIES, 'other')

    // Keep only known categories, drop the primary one if it was repeated, and
    // de-duplicate — the rollup unions these with best_fit_category.
    const additional = [...new Set(stringArray(source.additional_categories))]
        .filter((c): c is BestFitCategory => (BEST_FIT_CATEGORIES as readonly string[]).includes(c))
        .filter(c => c !== bestFit)

    return {
        schema_version: DELTA_SCHEMA_VERSION,
        customer_name: nullableString(source.customer_name),
        discord_user: nullableString(source.discord_user),
        agent_name: nullableString(source.agent_name),
        conversation_channel: pickEnum<ConversationChannel>(
            source.conversation_channel, CONVERSATION_CHANNELS, 'other',
        ),
        conversation_last_message_date: isoDateOrNull(source.conversation_last_message_date),
        best_fit_category: bestFit,
        additional_categories: additional,
        comparison_sentiment: typeof source.comparison_sentiment === 'string'
            && (COMPARISON_SENTIMENTS as readonly string[]).includes(source.comparison_sentiment)
            ? source.comparison_sentiment as ComparisonSentiment
            : null,
        newly_detected_pattern: nullableString(source.newly_detected_pattern),
        alpha_fit_signal: pickEnum<AlphaFitSignal>(source.alpha_fit_signal, ALPHA_FIT_SIGNALS, 'none'),
        key_customer_quote: nullableString(source.key_customer_quote),
        forensic_analysis: plainString(source.forensic_analysis),
        what_agent_did_well: stringArray(source.what_agent_did_well),
        guideline_improvements: stringArray(source.guideline_improvements),
        follow_up: {
            action_type: pickEnum<ActionType>(followUpSource.action_type, ACTION_TYPES, 'no_action_needed'),
            objective: plainString(followUpSource.objective),
            suggested_message_es: plainString(followUpSource.suggested_message_es),
        },
        suggested_recontact_date: isoDateOrNull(source.suggested_recontact_date),
        recontact_rationale: plainString(source.recontact_rationale),
        priority: pickEnum<Priority>(source.priority, PRIORITIES, 'medium'),
        // Always 'pending' — the team's real workflow state lives on
        // Bitacora.followUpStatus, not in this artifact.
        status: 'pending',
        data_quality_flags: stringArray(source.data_quality_flags),
    }
}
