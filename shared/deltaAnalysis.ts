// Controlled vocabulary + types for the STC Delta Conversation Analysis.
//
// One Discord/WhatsApp conversation screenshot becomes one row of the
// follow-up bitácora: what the customer signalled, how the agent handled it
// against the STC Delta → Alpha playbook, and the next action to take.
//
// This module is the single source of truth for both the server (prompt
// schema, normalization, aggregations) and the dashboard pages. Import it as
// `#shared/deltaAnalysis` from either side — do not re-declare these lists.

export const DELTA_SCHEMA_VERSION = '1.0'

/** Conversation categories. `other` is the escape hatch — when the model uses
 *  it, `newly_detected_pattern` should describe what it actually saw. */
export const BEST_FIT_CATEGORIES = [
    'presents_objections',
    'lost_in_learning_journey',
    'frustration_with_performance',
    'cost_sensitivity',
    'technical_trading_doubt',
    'im_ok_no_need',
    'comparison_with_other_programs',
    'explicit_alpha_intent',
    'showing_results_positive',
    'wants_closer_accompaniment',
    'onboarding_or_access_issue',
    'timezone_or_schedule_constraint',
    'security_or_brand_trust',
    'cancellation_or_churn',
    'no_response_cold_followup',
    'other',
] as const
export type BestFitCategory = typeof BEST_FIT_CATEGORIES[number]

/** The single next action an agent should take for this customer. */
export const ACTION_TYPES = [
    'plant_alpha_seed',
    'route_to_strategy_call',
    'resolve_open_doubt',
    'post_session_attendance_checkin',
    'post_recorded_qa_checkin',
    'learning_progress_checkin',
    'demo_progress_checkin',
    'real_money_checkin',
    'retention_save',
    'reactivation',
    'brand_trust_reassurance',
    'onboarding_assist',
    'no_action_needed',
] as const
export type ActionType = typeof ACTION_TYPES[number]

export const ALPHA_FIT_SIGNALS = ['explicit', 'strong', 'warming', 'not_yet', 'none', 'churn_risk'] as const
export type AlphaFitSignal = typeof ALPHA_FIT_SIGNALS[number]

export const PRIORITIES = ['high', 'medium', 'low'] as const
export type Priority = typeof PRIORITIES[number]

export const COMPARISON_SENTIMENTS = ['favorable', 'unfavorable', 'neutral'] as const
export type ComparisonSentiment = typeof COMPARISON_SENTIMENTS[number]

export const CONVERSATION_CHANNELS = ['discord', 'whatsapp', 'other'] as const
export type ConversationChannel = typeof CONVERSATION_CHANNELS[number]

/** Workflow state, tracked on promoted Bitacora fields (not inside the AI
 *  result — the result is an immutable artifact of the analysis run). */
export const FOLLOW_UP_STATUSES = ['pending', 'done'] as const
export type FollowUpStatus = typeof FOLLOW_UP_STATUSES[number]

export interface DeltaFollowUp {
    action_type: ActionType
    objective: string
    /** Ready-to-send Spanish message, playbook tone, ends with a forward step. */
    suggested_message_es: string
}

/** The AI output. Key names are fixed by the client spec — do not rename. */
export interface DeltaAnalysisResult {
    schema_version: string
    customer_name: string | null
    discord_user: string | null
    agent_name: string | null
    conversation_channel: ConversationChannel
    conversation_last_message_date: string | null
    best_fit_category: BestFitCategory
    additional_categories: BestFitCategory[]
    comparison_sentiment: ComparisonSentiment | null
    newly_detected_pattern: string | null
    alpha_fit_signal: AlphaFitSignal
    /** The customer's own words, verbatim in their original language. */
    key_customer_quote: string | null
    forensic_analysis: string
    what_agent_did_well: string[]
    guideline_improvements: string[]
    follow_up: DeltaFollowUp
    suggested_recontact_date: string | null
    recontact_rationale: string
    priority: Priority
    /** Always 'pending' — an artifact of the run. The team's real workflow
     *  state lives on Bitacora.followUpStatus. */
    status: 'pending'
    data_quality_flags: string[]
}

// ─── Spanish UI labels ──────────────────────────────────────────────────────

export const CATEGORY_LABELS_ES: Record<BestFitCategory, string> = {
    presents_objections: 'Presenta objeciones',
    lost_in_learning_journey: 'Perdido en el aprendizaje',
    frustration_with_performance: 'Frustración con resultados',
    cost_sensitivity: 'Sensibilidad al precio',
    technical_trading_doubt: 'Duda técnica de trading',
    im_ok_no_need: '«Estoy bien» / sin necesidad',
    comparison_with_other_programs: 'Compara con otros programas',
    explicit_alpha_intent: 'Intención explícita de Alpha',
    showing_results_positive: 'Muestra resultados positivos',
    wants_closer_accompaniment: 'Quiere acompañamiento cercano',
    onboarding_or_access_issue: 'Onboarding / acceso',
    timezone_or_schedule_constraint: 'Horario / zona horaria',
    security_or_brand_trust: 'Seguridad / confianza de marca',
    cancellation_or_churn: 'Cancelación / abandono',
    no_response_cold_followup: 'Sin respuesta / seguimiento frío',
    other: 'Otro',
}

export const ACTION_TYPE_LABELS_ES: Record<ActionType, string> = {
    plant_alpha_seed: 'Plantar semilla de Alpha',
    route_to_strategy_call: 'Derivar a llamada de estrategia',
    resolve_open_doubt: 'Resolver duda abierta',
    post_session_attendance_checkin: 'Check-in tras sesión en vivo',
    post_recorded_qa_checkin: 'Check-in tras Q&A grabado',
    learning_progress_checkin: 'Check-in de progreso',
    demo_progress_checkin: 'Check-in de demo',
    real_money_checkin: 'Check-in de cuenta real',
    retention_save: 'Intento de retención',
    reactivation: 'Reactivación',
    brand_trust_reassurance: 'Tranquilizar sobre seguridad',
    onboarding_assist: 'Asistencia de onboarding',
    no_action_needed: 'Sin acción necesaria',
}

export const ALPHA_SIGNAL_LABELS_ES: Record<AlphaFitSignal, string> = {
    explicit: 'Intención explícita',
    strong: 'Encaje fuerte',
    warming: 'Calentando',
    not_yet: 'Aún no',
    none: 'Sin señal',
    churn_risk: 'Riesgo de fuga',
}

export const PRIORITY_LABELS_ES: Record<Priority, string> = {
    high: 'Alta',
    medium: 'Media',
    low: 'Baja',
}

export const CHANNEL_LABELS_ES: Record<ConversationChannel, string> = {
    discord: 'Discord',
    whatsapp: 'WhatsApp',
    other: 'Otro',
}

export const COMPARISON_LABELS_ES: Record<ComparisonSentiment, string> = {
    favorable: 'Favorable',
    unfavorable: 'Desfavorable',
    neutral: 'Neutral',
}

// ─── UI helpers ─────────────────────────────────────────────────────────────

/** Queue sort order. Lower sorts first. */
export const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

/** Maps onto the .stc-badge tone classes in app/assets/css/main.css. */
export const PRIORITY_TONE: Record<Priority, string> = {
    high: 'red',
    medium: 'gold',
    low: 'neutral',
}

export const ALPHA_SIGNAL_TONE: Record<AlphaFitSignal, string> = {
    explicit: 'gold',
    strong: 'gold',
    warming: 'blue',
    not_yet: 'neutral',
    none: 'neutral',
    churn_risk: 'red',
}

export function categoryLabel(cat: string): string {
    return CATEGORY_LABELS_ES[cat as BestFitCategory] ?? cat
}

export function actionTypeLabel(action: string): string {
    return ACTION_TYPE_LABELS_ES[action as ActionType] ?? action
}
