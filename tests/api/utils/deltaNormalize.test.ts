import { describe, it, expect, beforeAll } from 'vitest'

let normalizeDeltaResult: (raw: any) => any

beforeAll(async () => {
    //@ts-ignore
    ;({ normalizeDeltaResult } = await import('#server/utils/deltaNormalize'))
})

/** A payload shaped exactly as the model is asked to return it. */
function validRaw(overrides: Record<string, any> = {}) {
    return {
        schema_version: '1.0',
        customer_name: 'DaniH',
        discord_user: 'danih',
        agent_name: 'Bernardo',
        conversation_channel: 'discord',
        conversation_last_message_date: '2026-06-08',
        best_fit_category: 'showing_results_positive',
        additional_categories: ['im_ok_no_need'],
        comparison_sentiment: null,
        newly_detected_pattern: null,
        alpha_fit_signal: 'strong',
        key_customer_quote: 'de momento todo bien',
        forensic_analysis: 'Shared a green calendar; agent closed without a next step.',
        what_agent_did_well: ['Warm acknowledgement'],
        guideline_improvements: ['One Rule violation: thread closed with no next step'],
        follow_up: {
            action_type: 'plant_alpha_seed',
            objective: 'Reconnect on results and offer to explain Alpha.',
            suggested_message_es: 'Dani, esos resultados hablan solos.',
        },
        suggested_recontact_date: '2026-06-16',
        recontact_rationale: 'Plant-seed cadence keeps it natural.',
        priority: 'high',
        status: 'pending',
        data_quality_flags: [],
        ...overrides,
    }
}

describe('normalizeDeltaResult', () => {
    it('passes a well-formed payload through intact', () => {
        const result = normalizeDeltaResult(validRaw())

        expect(result.customer_name).toBe('DaniH')
        expect(result.best_fit_category).toBe('showing_results_positive')
        expect(result.additional_categories).toEqual(['im_ok_no_need'])
        expect(result.alpha_fit_signal).toBe('strong')
        expect(result.follow_up.action_type).toBe('plant_alpha_seed')
        expect(result.priority).toBe('high')
        expect(result.suggested_recontact_date).toBe('2026-06-16')
    })

    it('always forces schema_version and status', () => {
        const result = normalizeDeltaResult(validRaw({ schema_version: '9.9', status: 'done' }))
        expect(result.schema_version).toBe('1.0')
        expect(result.status).toBe('pending')
    })

    it('clamps unknown enum values to their fallbacks', () => {
        const result = normalizeDeltaResult(validRaw({
            best_fit_category: 'made_up_category',
            alpha_fit_signal: 'super_hot',
            priority: 'urgent',
            conversation_channel: 'telegram',
            follow_up: { action_type: 'close_the_deal', objective: 'x', suggested_message_es: 'y' },
        }))

        expect(result.best_fit_category).toBe('other')
        expect(result.alpha_fit_signal).toBe('none')
        expect(result.priority).toBe('medium')
        expect(result.conversation_channel).toBe('other')
        expect(result.follow_up.action_type).toBe('no_action_needed')
    })

    it('drops unknown categories, duplicates, and the primary from additional_categories', () => {
        const result = normalizeDeltaResult(validRaw({
            best_fit_category: 'cost_sensitivity',
            additional_categories: [
                'cost_sensitivity',      // same as primary → dropped
                'im_ok_no_need',
                'im_ok_no_need',         // duplicate → collapsed
                'not_a_real_category',   // unknown → dropped
            ],
        }))

        expect(result.additional_categories).toEqual(['im_ok_no_need'])
    })

    it('nulls an invalid comparison_sentiment but keeps a valid one', () => {
        expect(normalizeDeltaResult(validRaw({ comparison_sentiment: 'meh' })).comparison_sentiment).toBeNull()
        expect(normalizeDeltaResult(validRaw({ comparison_sentiment: 'favorable' })).comparison_sentiment)
            .toBe('favorable')
    })

    it('nulls unparseable dates and keeps parseable ones', () => {
        expect(normalizeDeltaResult(validRaw({ suggested_recontact_date: 'next tuesday' }))
            .suggested_recontact_date).toBeNull()
        expect(normalizeDeltaResult(validRaw({ conversation_last_message_date: '' }))
            .conversation_last_message_date).toBeNull()
        expect(normalizeDeltaResult(validRaw({ suggested_recontact_date: '2026-07-01' }))
            .suggested_recontact_date).toBe('2026-07-01')
    })

    it('defaults arrays and blank strings when fields are missing entirely', () => {
        const result = normalizeDeltaResult({})

        expect(result.what_agent_did_well).toEqual([])
        expect(result.guideline_improvements).toEqual([])
        expect(result.additional_categories).toEqual([])
        expect(result.data_quality_flags).toEqual([])
        expect(result.forensic_analysis).toBe('')
        expect(result.follow_up.suggested_message_es).toBe('')
        expect(result.customer_name).toBeNull()
        expect(result.best_fit_category).toBe('other')
        expect(result.status).toBe('pending')
    })

    it('strips non-string and blank array members', () => {
        const result = normalizeDeltaResult(validRaw({
            what_agent_did_well: ['kept warmth', '', '   ', 42, null, 'used their name'],
        }))
        expect(result.what_agent_did_well).toEqual(['kept warmth', 'used their name'])
    })

    it('survives a null or non-object payload', () => {
        expect(normalizeDeltaResult(null).best_fit_category).toBe('other')
        expect(normalizeDeltaResult('nope').follow_up.action_type).toBe('no_action_needed')
    })
})
