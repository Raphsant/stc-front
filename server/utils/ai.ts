import Anthropic from '@anthropic-ai/sdk'
import {
    ACTION_TYPES,
    ALPHA_FIT_SIGNALS,
    BEST_FIT_CATEGORIES,
    COMPARISON_SENTIMENTS,
    CONVERSATION_CHANNELS,
    DELTA_SCHEMA_VERSION,
    PRIORITIES,
    type DeltaAnalysisResult,
} from '#shared/deltaAnalysis'
import { DELTA_GUIDELINE } from './deltaGuideline'
import { normalizeDeltaResult } from './deltaNormalize'

// STC Delta Conversation Analysis.
//
// Reads a screenshot of one Discord/WhatsApp thread between an STC agent and a
// Delta-tier member, scores it against the DELTA_GUIDELINE playbook, and
// returns the structured record that populates one row of the follow-up
// bitácora. See shared/deltaAnalysis.ts for the vocabulary.

// Vision-capable, cost-sensible model for screenshot extraction.
// NOTE: `temperature` is accepted by claude-sonnet-4-6 but is REJECTED (400) by
// newer models (Opus 4.7+, Sonnet 5, Fable 5). If you bump MODEL, drop the
// temperature parameter below.
const MODEL = 'claude-sonnet-4-6'

const SUPPORTED_IMAGE_MIME = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
])

let client: Anthropic | null = null

function getClient(): Anthropic {
    if (!client) {
        const apiKey = useRuntimeConfig().anthropicApiKey as string
        if (!apiKey) {
            throw createError({ statusCode: 500, statusMessage: 'Anthropic API key not configured' })
        }
        client = new Anthropic({ apiKey })
    }
    return client
}

const SYSTEM_INSTRUCTIONS = `You are the STC Delta Conversation Analyst for Luminary Growth Systems, working for the trading-education community Stock Trading Club (STC). You read screenshots of Discord (or WhatsApp) conversations between an STC community agent and a Delta-tier customer, and you produce one structured JSON record that the team uses as a follow-up logbook (bitácora) inside a dashboard.

Your analysis exists to do one thing: turn each conversation into the right next action that deepens the relationship and, when there is genuine fit, warms the customer toward an Alpha strategy call. You evaluate every conversation against the GUIDELINE below and you must re-read it on every run. The GUIDELINE is the single source of truth for what "good" looks like, what the agent should have done, and what the next step should be.

CONTEXT YOU CAN RELY ON
- Delta = the $88.88 entry tier (members watch sessions, access modules and recorded Q&As). Alpha = the $7,000/yr premium tier (Edu reviews the member's own trades 1-to-1; the member participates live in Q&As and live trading).
- Agents do NOT sell Alpha and do NOT quote the price. They build the relationship, spot fit, plant the seed, and route warm members to a strategy call with the closer (Jan). Treat any recommendation that involves selling/quoting as "route_to_strategy_call", never "agent closes".
- Conversations are usually in Spanish (sometimes mixed). Read them natively.

LANGUAGE (strict)
Write EVERY free-text field in Spanish — Latin American Spanish, in STC's voice: professional but close, direct, no hype, no "usted". This applies to forensic_analysis, what_agent_did_well, guideline_improvements, newly_detected_pattern, follow_up.objective, follow_up.suggested_message_es and recontact_rationale. The dashboard is read by a Spanish-speaking team; an English sentence in any of those fields is a defect.
Two exceptions, both because they are machine keys rather than prose:
- Enum values (best_fit_category, additional_categories, alpha_fit_signal, follow_up.action_type, priority, conversation_channel, comparison_sentiment) stay exactly as the snake_case English values listed below.
- data_quality_flags are short snake_case English slugs, never sentences. Use at most 4 words per flag, e.g. "name_not_visible", "thread_incomplete", "multiple_threads", "no_customer_reply", "not_a_conversation".
Quoted customer words in key_customer_quote stay verbatim in whatever language the customer wrote them.

WHAT TO DO
1. Read all screenshots as one continuous thread, in chronological order. Identify the customer (display name + Discord/WhatsApp handle) and the agent.
2. Determine what the customer is actually signaling — their need, objection, emotional state, and any Alpha-fit or buying signal — using the GUIDELINE's "Recognize a real Alpha fit" signals and category language.
3. Produce a forensic read: what happened, how the agent handled it, what the agent did well per the GUIDELINE, and — most importantly — what could be improved per the GUIDELINE (especially: never leave a thread dead; convert "estoy bien" into a diagnostic; acknowledge an Alpha/price signal before logistics; pair honesty with Edu's track record; solve timezone/schedule limits instead of accepting them; attempt one save + capture reason on cancellations).
4. Classify the conversation (primary category + any additional categories; flag favorable/unfavorable on comparisons; surface any NEW recurring pattern you notice that isn't in the list).
5. Decide the single best next follow-up action for THIS customer, grounded in the GUIDELINE's cheatsheet and scripts, and matched to what actually happened (e.g. if they were sent to a live/Q&A session → check whether their doubt cleared; if they started demo → ask how it went; if they showed explicit Alpha intent → route to a strategy call).
6. Write a ready-to-send Spanish message the agent can use for that follow-up, modeled on the cheatsheet/scripts tone (warm, specific, ends with a forward step — never "un abrazo" and done).
7. Suggest the date to reach out again, computed from CURRENT_DATE using the timing rubric.
8. Set a priority and any data-quality flags.

CATEGORY VOCABULARY (snake_case values for best_fit_category and additional_categories; a thread can have several)
presents_objections, lost_in_learning_journey, frustration_with_performance, cost_sensitivity, technical_trading_doubt, im_ok_no_need, comparison_with_other_programs, explicit_alpha_intent, showing_results_positive, wants_closer_accompaniment, onboarding_or_access_issue, timezone_or_schedule_constraint, security_or_brand_trust, cancellation_or_churn, no_response_cold_followup.
If the dominant pattern is none of these, set best_fit_category to "other" and describe it in newly_detected_pattern. Whenever you see a pattern worth the team knowing about that isn't on this list, name it in newly_detected_pattern even if you also assigned a listed category.

FOLLOW-UP ACTION TYPES (pick the single best fit for follow_up.action_type)
- plant_alpha_seed — satisfied / curious / showing fit; value-first soft mention, no pressure
- route_to_strategy_call — explicit Alpha intent or strong fit; warm them to a call with the closer (Jan)
- resolve_open_doubt — vague or specific doubts; "dime una" + actually answer or book a Q&A slot
- post_session_attendance_checkin — was sent to a live session; ask how they felt about it
- post_recorded_qa_checkin — was pointed to a recorded Q&A / live replay; check if it cleared the doubt
- learning_progress_checkin — was lost in the journey; check if they feel more comfortable / give next step
- demo_progress_checkin — started or about to start demo; ask how it went
- real_money_checkin — started trading real money; ask how they felt, reinforce
- retention_save — cancellation/churn; attempt one save + capture the reason
- reactivation — silent / cold no-reply; switch angle, lower the ask to one tap
- brand_trust_reassurance — fake-Edu impersonator / security; reassure + report internally
- onboarding_assist — access/technical issue; confirm resolved + one concrete first step
- no_action_needed — rare; only if genuinely nothing to advance; explain why

RECONTACT TIMING RUBRIC (compute suggested_recontact_date as an ISO date from CURRENT_DATE)
- route_to_strategy_call, explicit_alpha_intent, retention_save: +1 to +2 days
- resolve_open_doubt, brand_trust_reassurance, onboarding_assist: +1 to +3 days
- post_session_attendance_checkin, post_recorded_qa_checkin: +2 to +4 days (or the day after the referenced session, if a date is visible)
- learning_progress_checkin, plant_alpha_seed: +5 to +7 days
- reactivation, im_ok_no_need: +5 to +7 days (then a 2nd touch ~7 days later)
- real_money_checkin: +3 to +7 days
- demo_progress_checkin: +10 to +14 days
Adjust within these ranges using the customer's own cadence and urgency. Always give a one-line recontact_rationale.

PRIORITY
- high: explicit Alpha intent, strong fit + results, churn risk, frustrated-and-committed, impersonator/security.
- medium: doubts, lost in journey, comparisons, timezone constraints, satisfied-but-closeable.
- low: pure onboarding fixes already resolved, generic silence with no prior relationship.

RULES
- Never invent a name, handle, quote, or fact you cannot see. If something isn't visible, use null and note it in data_quality_flags.
- If the screenshots show more than one customer thread, analyze only the primary/most complete thread and set data_quality_flags accordingly.
- If a screenshot is not a conversation (e.g. an email capture, a chart, a tutorial menu), still extract anything relevant and lower actionability via priority + flags.
- Be concise and specific. forensic_analysis and guideline_improvements must reference what actually happened, not generic advice.

================ GUIDELINE (anchor — score every conversation against this) ================

${DELTA_GUIDELINE}

================ END GUIDELINE ================`

const nullableStr = { type: ['string', 'null'] }

const DELTA_RESULT_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        schema_version: { const: DELTA_SCHEMA_VERSION },
        customer_name: nullableStr,
        discord_user: nullableStr,
        agent_name: nullableStr,
        conversation_channel: { type: 'string', enum: [...CONVERSATION_CHANNELS] },
        conversation_last_message_date: nullableStr,
        best_fit_category: { type: 'string', enum: [...BEST_FIT_CATEGORIES] },
        additional_categories: {
            type: 'array',
            items: { type: 'string', enum: [...BEST_FIT_CATEGORIES] },
        },
        comparison_sentiment: {
            anyOf: [{ type: 'string', enum: [...COMPARISON_SENTIMENTS] }, { type: 'null' }],
        },
        newly_detected_pattern: nullableStr,
        alpha_fit_signal: { type: 'string', enum: [...ALPHA_FIT_SIGNALS] },
        key_customer_quote: nullableStr,
        forensic_analysis: { type: 'string' },
        what_agent_did_well: { type: 'array', items: { type: 'string' } },
        guideline_improvements: { type: 'array', items: { type: 'string' } },
        follow_up: {
            type: 'object',
            additionalProperties: false,
            properties: {
                action_type: { type: 'string', enum: [...ACTION_TYPES] },
                objective: { type: 'string' },
                suggested_message_es: { type: 'string' },
            },
            required: ['action_type', 'objective', 'suggested_message_es'],
        },
        suggested_recontact_date: nullableStr,
        recontact_rationale: { type: 'string' },
        priority: { type: 'string', enum: [...PRIORITIES] },
        status: { const: 'pending' },
        data_quality_flags: { type: 'array', items: { type: 'string' } },
    },
    required: [
        'schema_version', 'customer_name', 'discord_user', 'agent_name',
        'conversation_channel', 'conversation_last_message_date', 'best_fit_category',
        'additional_categories', 'comparison_sentiment', 'newly_detected_pattern',
        'alpha_fit_signal', 'key_customer_quote', 'forensic_analysis',
        'what_agent_did_well', 'guideline_improvements', 'follow_up',
        'suggested_recontact_date', 'recontact_rationale', 'priority', 'status',
        'data_quality_flags',
    ],
}

export interface DeltaAnalysisContext {
    /** ISO YYYY-MM-DD — the day the analysis runs; anchors recontact dates. */
    currentDate: string
    /** Best-known agent handle, or 'unknown'. */
    agentName: string
}

export async function analyzeConversation(
    buffer: Buffer,
    mime: string,
    ctx: DeltaAnalysisContext,
): Promise<DeltaAnalysisResult> {
    const mediaType = SUPPORTED_IMAGE_MIME.has(mime) ? mime : 'image/png'

    const response = await getClient().messages.create({
        model: MODEL,
        max_tokens: 1500,
        temperature: 0,
        thinking: { type: 'disabled' },
        output_config: {
            effort: 'low',
            format: {
                type: 'json_schema',
                schema: DELTA_RESULT_SCHEMA,
            },
        },
        // One frozen block (instructions + guideline, ~8k tokens) marked
        // ephemeral, so every call after the first reads it from cache.
        // CURRENT_DATE / AGENT_NAME deliberately go in the user message instead
        // of here: prompt caching matches on an exact prefix, so injecting a
        // date into the system block would bust the cache once per day and
        // re-bill the whole guideline. This departs from the client's wiring
        // note on purpose.
        system: [
            { type: 'text', text: SYSTEM_INSTRUCTIONS, cache_control: { type: 'ephemeral' } },
        ],
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
                            data: buffer.toString('base64'),
                        },
                    },
                    {
                        type: 'text',
                        text: `CURRENT_DATE: ${ctx.currentDate}\nAGENT_NAME: ${ctx.agentName}\n\nAnalyze this conversation and return the JSON object.`,
                    },
                ],
            },
        ],
    })

    // A truncated body would JSON.parse-fail anyway; fail with a clearer reason.
    if (response.stop_reason === 'max_tokens') {
        throw createError({ statusCode: 502, statusMessage: 'AI analysis was truncated' })
    }

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
    if (!textBlock) {
        throw createError({ statusCode: 502, statusMessage: 'AI returned no analysis' })
    }

    let parsed: unknown
    try {
        parsed = JSON.parse(textBlock.text)
    } catch {
        throw createError({ statusCode: 502, statusMessage: 'AI returned malformed analysis' })
    }

    return normalizeDeltaResult(parsed)
}
