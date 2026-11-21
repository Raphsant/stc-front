import { describe, expect, it } from 'vitest'
import {
    addDaysTo,
    addMonthsTo,
    asOfLabel,
    chicagoDay,
    failureCodeLabel,
    formatRate,
    formatUsd,
    formatUsdShort,
    formatUsdSigned,
    mismatchLabel,
    mismatchValue,
    monthLabel,
    mrrChartPoints,
    periodLabel,
    rangePresets,
    recentMonths,
    sourceLabel,
} from '../../app/utils/metrics'
import fixtures from '../fixtures/billingMetrics.json'

// Intl puts a no-break space between number and symbol; compare without caring which space.
const plain = (s: string) => s.replace(/[  ]/g, ' ')

describe('money and rates', () => {
    it('formats integer cents as dollars and shows a dash for a value that was left out', () => {
        expect(plain(formatUsd(490000))).toBe('4900,00 US$')
        expect(plain(formatUsd(0))).toBe('0,00 US$')
        expect(formatUsd(null)).toBe('—')
        expect(formatUsd(undefined)).toBe('—')
        expect(plain(formatUsdShort(3500049))).toBe('35.000 US$')
    })

    it('puts a sign on a movement', () => {
        expect(plain(formatUsdSigned(4900))).toBe('+49,00 US$')
        expect(plain(formatUsdSigned(-4900))).toBe('−49,00 US$')
        expect(plain(formatUsdSigned(0))).toBe('0,00 US$')
        expect(formatUsdSigned(null)).toBe('—')
    })

    it('formats a rate as a percentage and no rate as a dash', () => {
        expect(plain(formatRate(0.375))).toBe('37,5 %')
        expect(plain(formatRate(1))).toBe('100 %')
        expect(plain(formatRate(0))).toBe('0 %')
        expect(formatRate(null)).toBe('—')
    })
})

describe('Chicago days and months', () => {
    it('takes the day from Chicago, not from UTC or the browser', () => {
        // 03:30 UTC on the 21st is still the evening of the 20th in Chicago.
        expect(chicagoDay(new Date('2026-11-21T03:30:00Z'))).toBe('2026-11-20')
        expect(chicagoDay(new Date('2026-11-21T06:00:00Z'))).toBe('2026-11-21')
    })

    it('moves by days and months across year ends', () => {
        expect(addDaysTo('2026-01-01', -1)).toBe('2025-12-31')
        expect(addDaysTo('2026-11-20', -29)).toBe('2026-10-22')
        expect(addMonthsTo('2026-01', -1)).toBe('2025-12')
        expect(addMonthsTo('2026-11', -11)).toBe('2025-12')
    })

    it('offers this month, 30 and 90 days by day, and 12 months by month', () => {
        expect(rangePresets('2026-11-20')).toEqual([
            { key: 'month', label: 'Este mes', from: '2026-11-01', to: '2026-11-20', bucket: 'day' },
            { key: '30d', label: '30 días', from: '2026-10-22', to: '2026-11-20', bucket: 'day' },
            { key: '90d', label: '90 días', from: '2026-08-23', to: '2026-11-20', bucket: 'day' },
            { key: '12m', label: '12 meses', from: '2025-12-01', to: '2026-11-20', bucket: 'month' },
        ])
    })

    it('lists the last twelve months, newest first', () => {
        const months = recentMonths('2026-02-03')
        expect(months).toHaveLength(12)
        expect(months[0]).toEqual({ value: '2026-02', label: 'febrero 2026' })
        expect(months[2]).toEqual({ value: '2025-12', label: 'diciembre 2025' })
        expect(months[11]!.value).toBe('2025-03')
    })

    it('labels a period', () => {
        expect(monthLabel('2026-11')).toBe('noviembre 2026')
        expect(periodLabel('2026-11-20')).toBe('20 nov')
        expect(periodLabel('2026-11')).toBe('nov 2026')
    })
})

describe('labels', () => {
    it('explains a decline code, and shows one it does not know as it comes', () => {
        expect(failureCodeLabel('insufficient_funds')).toBe('Fondos insuficientes')
        expect(failureCodeLabel('authentication_required')).toBe('Requiere confirmación (3-D Secure)')
        expect(failureCodeLabel('some_new_code')).toBe('some_new_code')
        expect(failureCodeLabel(null)).toBe('Sin motivo registrado')
        // every code in a real answer has something to show
        for (const c of fixtures.failedPayments.data.byFailureCode) expect(failureCodeLabel(c.code)).toBeTruthy()
    })

    it('names a signup source', () => {
        expect(sourceLabel('direct')).toBe('Directo')
        expect(sourceLabel('(none)')).toBe('Sin dato')
        expect(sourceLabel('(no order)')).toBe('Sin compra iniciada')
        expect(sourceLabel('affiliate:aff_7')).toBe('Afiliado aff_7')
        expect(sourceLabel('youtube')).toBe('youtube')
    })

    it('explains a mismatch and shows its two values', () => {
        const m = fixtures.reconciliation.data.runs.find((r) => r.status === 'mismatch')!.mismatches[0] as any
        expect(mismatchLabel(m.kind)).toBe('Pago en Stripe que no tenemos')
        expect(mismatchValue(m.kind, m.ours)).toBe('—')
        expect(plain(mismatchValue(m.kind, m.theirs))).toBe('49,00 US$')
        expect(mismatchValue('status', 'active')).toBe('active')
        expect(mismatchValue('failure_missing', { attempts: 2 })).toBe('{"attempts":2}')
        expect(mismatchLabel('brand_new_kind')).toBe('brand_new_kind')
    })
})

describe('chart and freshness', () => {
    it('plots MRR at the end of each bucket in dollars', () => {
        const points = mrrChartPoints(fixtures.mrrByMonth.data.buckets)
        expect(points).toHaveLength(fixtures.mrrByMonth.data.buckets.length)
        expect(points.at(-1)!.value).toBe(Math.round(fixtures.summary.data.mrr / 100))
        expect(mrrChartPoints(null)).toEqual([])
    })

    it('says how fresh a report is', () => {
        const now = Date.parse('2026-11-20T18:00:00Z')
        expect(asOfLabel('2026-11-20T17:59:40Z', now)).toBe('Calculado ahora')
        expect(asOfLabel('2026-11-20T17:48:00Z', now)).toBe('Calculado hace 12 min')
        expect(asOfLabel(null, now)).toBe('')
    })
})
