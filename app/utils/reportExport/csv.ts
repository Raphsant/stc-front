import type { ReportRow } from '#shared/reports'
import { formatDay, type ExportColumn } from './columns'

const BOM = '﻿'

function cell(v: unknown): string {
    if (v === null || v === undefined) return ''
    if (v instanceof Date) return formatDay(v)
    if (typeof v === 'number') return String(v)
    let s = String(v)
    // Spreadsheet apps run cells starting with = + - @ as formulas; usernames
    // and roles are user-controlled, so neutralise them.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * UTF-8 with BOM, `;` separator and CRLF: opens with accents intact in a
 * Spanish-locale Excel, where `,` is the decimal separator.
 */
export function buildCsv(columns: ExportColumn[], rows: ReportRow[]): string {
    const lines = [columns.map(c => cell(c.header)).join(';')]
    for (const r of rows) lines.push(columns.map(c => cell(c.value(r))).join(';'))
    return BOM + lines.join('\r\n') + '\r\n'
}
