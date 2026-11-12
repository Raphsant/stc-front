import { describe, it, expect } from 'vitest'
import { buildCsv } from '../../app/utils/reportExport/csv'
import { EXPORT_COLUMNS, exportFileName, formatDay } from '../../app/utils/reportExport/columns'
import { latin1 } from '../../app/utils/reportExport/pdf'
import { toRow } from '#shared/reports'

const NOW = Date.UTC(2026, 10, 11, 12)

function row(over: Record<string, any> = {}) {
    return toRow({
        _id: '123456789012345678',
        username: 'José "el ñu"; trader',
        roles: ['@everyone', 'Delta'],
        joinedAt: '2026-01-05T10:00:00Z',
        cfContactId: 9,
        cfLocation: { country: 'ES', region: 'Barcelona', regionKey: 'B', city: 'Barcelona', cityKey: 'barcelona' },
        cfMembership: { status: 'active', expiresAt: '2026-12-01T00:00:00Z', syncedAt: '2026-11-11T00:00:00Z' },
        meetingCount: 3,
        messages30d: 12,
        messageCount: 400,
        contactedBy: ['raph', 'edu'],
        ...over,
    }, NOW)
}

describe('buildCsv', () => {
    it('starts with a BOM, uses ; and CRLF, and has one line per row', () => {
        const csv = buildCsv(EXPORT_COLUMNS, [row(), row({ username: 'plain' })])
        expect(csv.charCodeAt(0)).toBe(0xfeff)
        const lines = csv.slice(1).split('\r\n')
        expect(lines).toHaveLength(4) // header + 2 rows + trailing newline
        expect(lines[0]!.split(';')).toHaveLength(EXPORT_COLUMNS.length)
        expect(lines[0]).toContain('Usuario;Discord ID;Tier')
    })

    it('quotes separators and quotes, keeps accents, formats dates as dd/mm/yyyy', () => {
        const csv = buildCsv(EXPORT_COLUMNS, [row()])
        expect(csv).toContain('"José ""el ñu""; trader";123456789012345678;Delta;Delta;España;Barcelona;Barcelona')
        expect(csv).toContain(';05/01/2026;') // joinedAt
        expect(csv).toContain(';01/12/2026;20;Activo;ClickFunnels;raph, edu;Sí')
    })

    it('neutralises cells that a spreadsheet would run as a formula', () => {
        const csv = buildCsv(EXPORT_COLUMNS, [row({ username: '=HYPERLINK("http://x")' })])
        expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`)
        // A negative number stays a number
        const expired = buildCsv(EXPORT_COLUMNS, [row({ cfMembership: { status: 'canceled', expiresAt: '2026-11-01T00:00:00Z', syncedAt: '2026-11-11T00:00:00Z' } })])
        expect(expired).toContain(';01/11/2026;-10;Cancelado;')
    })

    it('leaves unknown values empty', () => {
        const csv = buildCsv(EXPORT_COLUMNS, [row({ cfLocation: null, cfMembership: null, contactedBy: [], cfContactId: null })])
        expect(csv).toContain(';Delta;Delta;;;;En el servidor;')
        expect(csv).toContain(';;;Sin dato;;;No')
    })
})

describe('export helpers', () => {
    it('builds a safe file name from the title', () => {
        expect(exportFileName('Usuarios Delta en Barcelona, España · vencen en 30 días', new Date('2026-11-11T08:00:00Z'), 'pdf'))
            .toBe('reporte-usuarios-delta-en-barcelona-espana-vencen-en-30-dias_2026-11-11.pdf')
    })

    it('formats days in UTC', () => {
        expect(formatDay('2026-12-01T00:30:00Z')).toBe('01/12/2026')
        expect(formatDay(null)).toBe('')
    })

    it('keeps Spanish text and replaces what the PDF font cannot draw', () => {
        expect(latin1('Año · España ≥ 3 🚀 – ok')).toBe('Año · España >= 3 ? - ok')
    })
})
