import type { ReportRow } from '#shared/reports'
import { formatDateTime, formatDay, summarySections, type ExportColumn, type ExportMeta } from './columns'

// jsPDF's built-in Helvetica is WinAnsi (Latin-1): Spanish accents and ñ are
// fine, anything else (emoji, CJK, ≥) is not. Swap what has a plain
// equivalent and replace the rest so no cell renders as garbage.
export function latin1(s: string): string {
    return s
        .replace(/≥/g, '>=')
        .replace(/≤/g, '<=')
        .replace(/[–—]/g, '-')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/[^ -~ -ÿ]/gu, '?')
}

export async function buildPdf(columns: ExportColumn[], rows: ReportRow[], meta: ExportMeta): Promise<Blob> {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])

    const cols = columns.filter(c => c.pdf)
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    const W = doc.internal.pageSize.getWidth()
    const H = doc.internal.pageSize.getHeight()
    const M = 36

    // Header block
    doc.setFillColor(234, 157, 19)
    doc.rect(M, M, 46, 3, 'F')
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(120)
    doc.text('STOCKS TRADING CLUB · REPORTE', M, M + 18)
    doc.setFontSize(16).setTextColor(20)
    const titleLines = doc.splitTextToSize(latin1(meta.title), W - M * 2)
    doc.text(titleLines, M, M + 38)
    let y = M + 38 + (titleLines.length - 1) * 18 + 16

    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(90)
    const info = [
        `Generado: ${formatDateTime(meta.generatedAt)}`,
        `Usuarios: ${meta.total.toLocaleString('es-ES')} de ${meta.universe.toLocaleString('es-ES')}`,
        `Filtros: ${meta.filters.length ? meta.filters.join(' · ') : 'ninguno'}`,
    ]
    for (const line of info) {
        const wrapped = doc.splitTextToSize(latin1(line), W - M * 2)
        doc.text(wrapped, M, y)
        y += wrapped.length * 12
    }
    for (const sec of summarySections(meta.summary).slice(0, 3)) {
        const line = `${sec.title}: ${sec.items.map(([l, n]) => `${l} ${n}`).join(' · ')}`
        const wrapped = doc.splitTextToSize(latin1(line), W - M * 2)
        doc.text(wrapped, M, y)
        y += wrapped.length * 12
    }

    autoTable(doc, {
        startY: y + 8,
        margin: { left: M, right: M, top: M, bottom: M + 10 },
        head: [cols.map(c => c.header)],
        body: rows.map(r => cols.map((c) => {
            const v = c.value(r)
            if (v === null || v === '') return c.header === 'Vencimiento' ? 'Sin dato' : '—'
            return v instanceof Date ? formatDay(v) : latin1(String(v))
        })),
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, textColor: 30, lineColor: 225, lineWidth: 0.5, overflow: 'linebreak' },
        headStyles: { fillColor: [20, 20, 20], textColor: [245, 200, 66], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 246, 241] },
        columnStyles: Object.fromEntries(cols.map((c, i) => [i, { halign: c.type === 'number' ? 'right' : 'left' }])),
        showHead: 'everyPage',
        didParseCell: (d) => {
            if (d.section === 'head' && cols[d.column.index]?.type === 'number') d.cell.styles.halign = 'right'
        },
    })

    const pages = doc.getNumberOfPages()
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(130)
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i)
        doc.text(`Página ${i} de ${pages}`, W - M, H - 20, { align: 'right' })
        doc.text('STC Control', M, H - 20)
    }
    return doc.output('blob')
}
