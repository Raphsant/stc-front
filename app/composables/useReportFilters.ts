import { parseFilters, serializeFilters, type ReportFilters } from '#shared/reports'

// Report filters live in the URL query, so a report can be bookmarked,
// shared and survives a reload. The same parser runs on the server.
export function useReportFilters() {
    const route = useRoute()
    const router = useRouter()

    const filters = computed(() => parseFilters(route.query as Record<string, unknown>))
    const query = computed(() => serializeFilters(filters.value))

    function setFilters(next: ReportFilters) {
        // Re-parse so dependent fields are normalised (e.g. clearing the
        // country also clears region and city)
        const clean = serializeFilters(parseFilters(serializeFilters(next)))
        router.replace({ query: clean })
    }
    function patch(p: Partial<ReportFilters>) {
        setFilters({ ...filters.value, ...p })
    }
    function reset() {
        router.replace({ query: {} })
    }

    return { filters, query, setFilters, patch, reset }
}
