import type { ReportResponse } from '#shared/reports'
import { EXPORT_COLUMNS, exportFileName, type ExportMeta } from '~/utils/reportExport/columns'

export type ExportFormat = 'pdf' | 'csv' | 'xlsx'

function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Exports are built in the browser from the rows already on screen. Each
// format's code (and its library) is only loaded the first time it is used.
export function useReportExport() {
    const busy = ref<ExportFormat | null>(null)
    const toast = useToast()

    async function exportReport(format: ExportFormat, report: ReportResponse, title: string, filterLabels: string[]) {
        if (busy.value || !report.rows.length) return
        busy.value = format
        try {
            const meta: ExportMeta = {
                title,
                filters: filterLabels,
                generatedAt: new Date(report.generatedAt),
                total: report.total,
                universe: report.universe,
                summary: report.summary,
            }
            let blob: Blob
            if (format === 'csv') {
                const { buildCsv } = await import('~/utils/reportExport/csv')
                blob = new Blob([buildCsv(EXPORT_COLUMNS, report.rows)], { type: 'text/csv;charset=utf-8' })
            } else if (format === 'xlsx') {
                const { buildXlsx } = await import('~/utils/reportExport/xlsx')
                blob = await buildXlsx(EXPORT_COLUMNS, report.rows, meta)
            } else {
                const { buildPdf } = await import('~/utils/reportExport/pdf')
                blob = await buildPdf(EXPORT_COLUMNS, report.rows, meta)
            }
            download(blob, exportFileName(title, meta.generatedAt, format))
        } catch (e) {
            console.error(e)
            toast.add({ title: 'No se pudo exportar el reporte', description: 'Inténtalo de nuevo.', color: 'error' })
        } finally {
            busy.value = null
        }
    }

    return { busy, exportReport }
}
