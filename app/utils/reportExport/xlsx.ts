import type { ReportRow } from '#shared/reports'
import { formatDateTime, summarySections, type ExportColumn, type ExportMeta } from './columns'

const HEAD_BG = '#EA9D13'

export async function buildXlsx(columns: ExportColumn[], rows: ReportRow[], meta: ExportMeta): Promise<Blob> {
    const { default: writeXlsxFile } = await import('write-excel-file/browser')

    const bold = (value: string) => ({ value, fontWeight: 'bold' as const })
    const summary: any[][] = [
        [{ value: meta.title, fontWeight: 'bold', fontSize: 14 }],
        [],
        [bold('Generado'), formatDateTime(meta.generatedAt)],
        [bold('Filtros'), meta.filters.length ? meta.filters.join(' · ') : 'Ninguno'],
        [bold('Usuarios en el reporte'), meta.total],
        [bold('Universo'), meta.universe],
        [bold('Con fecha de vencimiento'), meta.summary.expiryCoverage.withDate],
        [bold('Sin fecha de vencimiento'), meta.summary.expiryCoverage.withoutDate],
    ]
    for (const sec of summarySections(meta.summary)) {
        summary.push([], [{ value: sec.title, fontWeight: 'bold', backgroundColor: HEAD_BG }, { value: 'Usuarios', fontWeight: 'bold', backgroundColor: HEAD_BG, align: 'right' }])
        for (const [label, count] of sec.items) summary.push([label, count])
    }

    const users: any[][] = [
        columns.map(c => ({ value: c.header, fontWeight: 'bold', backgroundColor: HEAD_BG })),
        ...rows.map(r => columns.map((c) => {
            const v = c.value(r)
            if (v === null || v === '') return null
            if (c.type === 'date') return { value: v as Date, type: Date, format: 'dd/mm/yyyy' }
            if (c.type === 'number') return { value: v as number, type: Number }
            return { value: String(v), type: String }
        })),
    ]

    return writeXlsxFile([
        { data: summary, sheet: 'Resumen', columns: [{ width: 30 }, { width: 60 }] },
        { data: users, sheet: 'Usuarios', columns: columns.map(c => ({ width: c.width })), stickyRowsCount: 1 },
    ]).toBlob()
}
