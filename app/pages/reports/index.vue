<script setup lang="ts">
import {
  ENGAGEMENT_LABELS,
  ENGAGEMENT_STATES,
  EXPIRY_BUCKETS,
  EXPIRY_BUCKET_LABELS,
  TIERS,
  TIER_LABELS,
  buildReportTitle,
  countryName,
  defaultFilters,
  describeFilters,
  serializeFilters,
  type ReportFilters,
  type ReportResponse,
} from '#shared/reports'
import type { BreakdownItem } from '~/components/reports/Breakdown.vue'
import type { ExportFormat } from '~/composables/useReportExport'

useSeoMeta({
  title: 'Reportes - STC Control',
  description: 'Genera reportes de usuarios por ubicación, tier, actividad y vencimiento de membresía.',
})

const { filters, query, setFilters, patch, reset } = useReportFilters()

const { data: report, status, error, refresh } = useFetch<ReportResponse>('/api/reports/users', { query, lazy: true })
const loading = computed(() => status.value === 'pending' || status.value === 'idle')

const { data: locations } = useFetch<{ noneCount: number; countries: any[] }>('/api/discord-users/locations', {
  query: computed(() => (filters.value.member === 'all' ? {} : { status: filters.value.member })),
  lazy: true,
  default: () => ({ noneCount: 0, countries: [] }),
})

// ── Title and chips ──
const locationNames = computed(() => {
  const country = locations.value?.countries.find((c: any) => c.code === filters.value.country)
  const region = country?.regions.find((r: any) => r.key === filters.value.region)
  const city = region?.cities.find((c: any) => c.key === filters.value.city)
  return { region: region?.name ?? null, city: city?.name ?? null }
})
const title = computed(() => buildReportTitle(filters.value, locationNames.value))
const chips = computed(() => describeFilters(filters.value, locationNames.value))

const rows = computed(() => report.value?.rows ?? [])
const summary = computed(() => report.value?.summary)
const total = computed(() => report.value?.total ?? 0)
const n = (v: number | undefined) => (v ?? 0).toLocaleString('es-ES')

// Admin names for the "contactado por" select
const admins = computed(() => {
  const set = new Set<string>(filters.value.contactedBy ? [filters.value.contactedBy] : [])
  for (const r of rows.value) for (const a of r.contactedBy) set.add(a)
  return [...set].sort((a, b) => a.localeCompare(b, 'es'))
})

// ── Presets: each one is a complete report ──
const presets: { label: string; icon: string; filters: Partial<ReportFilters> }[] = [
  { label: 'Vencen esta semana', icon: 'i-lucide-calendar-clock', filters: { expiry: 'week', sortBy: 'expiresAt', sortDir: 'asc' } },
  { label: 'Vencen este mes', icon: 'i-lucide-calendar-clock', filters: { expiry: 'month', sortBy: 'expiresAt', sortDir: 'asc' } },
  { label: 'Delta inactivos', icon: 'i-lucide-moon', filters: { tier: ['delta'], engagement: ['inactive', 'dormant'] } },
  { label: 'Sin ubicación', icon: 'i-lucide-map-pin-off', filters: { country: 'none' } },
  { label: 'Nunca contactados', icon: 'i-lucide-message-circle-off', filters: { contacted: 'no' } },
]
const presetKey = (p: Partial<ReportFilters>) => JSON.stringify(serializeFilters({ ...defaultFilters(), ...p }))
const currentKey = computed(() => JSON.stringify(query.value))
function applyPreset(p: Partial<ReportFilters>) {
  if (presetKey(p) === currentKey.value) reset()
  else setFilters({ ...defaultFilters(), ...p })
}

// ── Breakdowns ──
const locationBreakdown = computed<{ title: string; items: BreakdownItem[] }>(() => {
  const s = summary.value
  const f = filters.value
  if (!s) return { title: 'Por país', items: [] }
  if (s.byCity.length) {
    return { title: 'Por ciudad', items: s.byCity.map(c => ({ key: c.key, label: c.name, count: c.count, active: f.city === c.key })) }
  }
  if (s.byRegion.length) {
    return { title: 'Por provincia', items: s.byRegion.map(r => ({ key: r.key, label: r.name ?? 'Sin provincia', count: r.count, active: f.region === r.key, tone: r.key === 'none' ? 'neutral' : 'gold' })) }
  }
  return {
    title: 'Por país',
    items: s.byCountry.map(c => ({
      key: c.code ?? 'none',
      label: c.code ? countryLabel(c.code) : 'Sin ubicación',
      count: c.count,
      active: f.country === (c.code ?? 'none'),
      tone: c.code ? 'gold' : 'neutral',
    })),
  }
})
function selectLocation(key: string) {
  const f = filters.value
  const s = summary.value
  if (s?.byCity.length) patch({ city: f.city === key ? '' : key })
  else if (s?.byRegion.length) patch({ region: f.region === key ? '' : key, city: '' })
  else patch({ country: f.country === key ? '' : key, region: '', city: '' })
}

const tierItems = computed<BreakdownItem[]>(() => TIERS.map(t => ({
  key: t, label: TIER_LABELS[t], count: summary.value?.byTier[t] ?? 0,
  active: filters.value.tier.includes(t), tone: t === 'alpha' ? 'gold' : t === 'delta' ? 'blue' : 'neutral',
})))
const engagementTone = { active: 'green', slipping: 'gold', inactive: 'red', dormant: 'neutral' } as const
const engagementItems = computed<BreakdownItem[]>(() => ENGAGEMENT_STATES.map(e => ({
  key: e, label: ENGAGEMENT_LABELS[e], count: summary.value?.byEngagement[e] ?? 0,
  active: filters.value.engagement.includes(e), tone: engagementTone[e],
})))
const expiryItems = computed<BreakdownItem[]>(() => EXPIRY_BUCKETS.map(b => ({
  key: b, label: EXPIRY_BUCKET_LABELS[b], count: summary.value?.byExpiry[b] ?? 0,
  tone: b === 'expired' ? 'red' : b === 'd7' || b === 'd30' ? 'gold' : 'neutral',
})))
function toggleIn(key: 'tier' | 'engagement', value: string) {
  const cur = filters.value[key] as string[]
  patch({ [key]: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value] } as Partial<ReportFilters>)
}

const expiringSoon = computed(() => (summary.value ? summary.value.byExpiry.d7 + summary.value.byExpiry.d30 : 0))
const syncedLabel = computed(() => {
  const s = summary.value?.cfSyncedAt
  return s ? new Date(s).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null
})

// ── Filter overlay: bottom sheet on phones, side panel on tablets ──
const sheetOpen = ref(false)
const isPhone = ref(false)
onMounted(() => {
  const phone = window.matchMedia('(max-width: 767px)')
  const wide = window.matchMedia('(min-width: 1400px)')
  const sync = () => {
    isPhone.value = phone.matches
    if (wide.matches) sheetOpen.value = false // the rail takes over
  }
  sync()
  phone.addEventListener('change', sync)
  wide.addEventListener('change', sync)
  onBeforeUnmount(() => {
    phone.removeEventListener('change', sync)
    wide.removeEventListener('change', sync)
  })
})

// ── Export ──
const { busy, exportReport } = useReportExport()
async function onExport(format: ExportFormat) {
  if (report.value) await exportReport(format, report.value, title.value, chips.value.map(c => c.label))
  exportOpen.value = false
}

// ── Móvil (<768px) ──
// Pestañas: el CSS solo oculta el panel inactivo en móvil; en escritorio se ven ambos.
const mTab = ref<'resumen' | 'usuarios'>('resumen')

// Desgloses en carrusel: punto activo según el scroll horizontal.
const bdsEl = ref<HTMLElement>()
const bdIndex = ref(0)
function onBdsScroll() {
  const el = bdsEl.value
  const card = el?.firstElementChild as HTMLElement | null
  if (!el || !card) return
  bdIndex.value = Math.round(el.scrollLeft / (card.offsetWidth + 12))
}

const exportOpen = ref(false)
const EXPORT_FORMATS: { id: ExportFormat; label: string; hint: string; icon: string; tone: string }[] = [
  { id: 'pdf', label: 'PDF', hint: 'Para compartir o imprimir', icon: 'i-lucide-file-text', tone: 'gold' },
  { id: 'xlsx', label: 'Excel', hint: 'Con columnas y formato', icon: 'i-lucide-file-spreadsheet', tone: 'green' },
  { id: 'csv', label: 'CSV', hint: 'Datos en bruto', icon: 'i-lucide-table', tone: 'dim' },
]
</script>

<template>
  <div class="r-page">
    <header class="r-head">
      <div class="stc-eyebrow">Reporte</div>
      <h2 class="r-title">{{ title }}</h2>
    </header>

    <div class="r-layout">
      <!-- Desktop filter rail -->
      <aside class="r-rail stc-panel stc-scroll" aria-label="Filtros del reporte">
        <div class="r-rail-head">
          <h3 class="r-bd-title"><UIcon name="i-lucide-filter" class="w-4 h-4" />Filtros</h3>
          <button v-if="chips.length" type="button" class="r-link" @click="reset">Limpiar</button>
        </div>
        <ReportsFilters :filters="filters" :locations="locations" :admins="admins" @patch="patch" />
      </aside>

      <div class="r-main">
        <div class="r-results">
          <!-- Filter button + active chips -->
          <div class="r-toolbar">
            <button type="button" class="stc-btn r-open-filters" :class="{ 'gold-soft': chips.length }" @click="sheetOpen = true">
              <UIcon name="i-lucide-filter" class="w-4 h-4" />
              Filtros
              <span v-if="chips.length" class="r-count stc-mono">{{ chips.length }}</span>
            </button>
            <div v-if="chips.length" class="r-fchips" role="list" aria-label="Filtros activos">
              <button
                v-for="c in chips" :key="c.key" type="button" role="listitem" class="r-fchip"
                :aria-label="`Quitar filtro: ${c.label}`" @click="patch(c.clear)"
              >
                {{ c.label }}<UIcon name="i-lucide-x" class="w-3.5 h-3.5" />
              </button>
              <button type="button" class="r-link r-fclear" @click="reset">Limpiar todo</button>
            </div>
            <button
              type="button" class="stc-btn rm-share" :disabled="!total || !!error"
              aria-label="Exportar reporte" @click="exportOpen = true"
            >
              <UIcon name="i-lucide-share" class="w-4 h-4" />
            </button>
          </div>

          <!-- Presets -->
          <div class="r-presets" aria-label="Reportes rápidos">
            <span class="stc-eyebrow r-presets-lbl">Rápidos</span>
            <button
              v-for="p in presets" :key="p.label" type="button" class="r-preset"
              :class="{ on: presetKey(p.filters) === currentKey }" :aria-pressed="presetKey(p.filters) === currentKey"
              @click="applyPreset(p.filters)"
            >
              <UIcon :name="p.icon" class="w-3.5 h-3.5" />{{ p.label }}
            </button>
          </div>

          <!-- Móvil: pestañas Resumen / Usuarios -->
          <div class="rm-tabs stc-seg" role="tablist" aria-label="Vista del reporte">
            <button
              type="button" role="tab" :aria-selected="mTab === 'resumen'" :class="{ on: mTab === 'resumen' }"
              @click="mTab = 'resumen'"
            >Resumen</button>
            <button
              type="button" role="tab" :aria-selected="mTab === 'usuarios'" :class="{ on: mTab === 'usuarios' }"
              @click="mTab = 'usuarios'"
            >Usuarios<span class="rm-tab-n stc-mono">{{ report ? n(total) : '—' }}</span></button>
          </div>

          <!-- Error -->
          <div v-if="error" class="stc-panel stc-empty" role="alert">
            <UIcon name="i-lucide-triangle-alert" class="w-7 h-7" />
            <p>No se pudo generar el reporte.</p>
            <button type="button" class="stc-btn sm" @click="refresh()">
              <UIcon name="i-lucide-refresh-cw" class="w-3.5 h-3.5" />Reintentar
            </button>
          </div>

          <template v-else>
          <div class="rm-pane" :class="{ 'rm-hidden': mTab !== 'resumen' }" role="tabpanel">
            <!-- KPIs -->
            <div class="r-kpis" :class="{ 'r-stale': loading && report }">
              <div class="stc-panel stc-tile">
                <div class="stc-tile-head"><span class="lbl">Usuarios</span><UIcon name="i-lucide-users" class="w-4 h-4" /></div>
                <USkeleton v-if="!report" class="h-9 w-20" />
                <div v-else class="stc-tile-val gold">{{ n(total) }}</div>
                <div class="r-tile-foot">de {{ n(report?.universe) }} {{ filters.member === 'removed' ? 'eliminados' : filters.member === 'all' ? 'en total' : 'en el servidor' }}</div>
              </div>
              <div class="stc-panel stc-tile">
                <div class="stc-tile-head"><span class="lbl">Vencen en 30 días</span><UIcon name="i-lucide-calendar-clock" class="w-4 h-4" /></div>
                <USkeleton v-if="!report" class="h-9 w-16" />
                <div v-else class="stc-tile-val">{{ n(expiringSoon) }}</div>
                <div class="r-tile-foot">{{ n(summary?.byExpiry.expired) }} ya vencidas</div>
              </div>
              <div class="stc-panel stc-tile">
                <div class="stc-tile-head"><span class="lbl">Activos 7 días</span><UIcon name="i-lucide-activity" class="w-4 h-4" /></div>
                <USkeleton v-if="!report" class="h-9 w-16" />
                <div v-else class="stc-tile-val">{{ n(summary?.byEngagement.active) }}</div>
                <div class="r-tile-foot">{{ total ? Math.round(((summary?.byEngagement.active ?? 0) / total) * 100) : 0 }}% del reporte</div>
              </div>
              <div class="stc-panel stc-tile">
                <div class="stc-tile-head"><span class="lbl">Sin fecha de vencimiento</span><UIcon name="i-lucide-circle-help" class="w-4 h-4" /></div>
                <USkeleton v-if="!report" class="h-9 w-16" />
                <div v-else class="stc-tile-val">{{ n(summary?.expiryCoverage.withoutDate) }}</div>
                <div class="r-tile-foot">{{ n(summary?.expiryCoverage.withDate) }} con fecha</div>
              </div>
            </div>

            <!-- Data notes -->
            <p v-if="report && !summary?.cfSyncedAt" class="r-note">
              <UIcon name="i-lucide-info" class="w-4 h-4" />
              <span>El vencimiento de los Delta todavía no está sincronizado desde ClickFunnels. Por ahora solo los Alpha tienen fecha.</span>
            </p>
            <p v-else-if="syncedLabel" class="r-note subtle">
              <UIcon name="i-lucide-refresh-cw" class="w-3.5 h-3.5" />
              <span>Vencimientos de ClickFunnels sincronizados el {{ syncedLabel }}.</span>
            </p>
            <p v-if="filters.member !== 'active'" class="r-note subtle">
              <UIcon name="i-lucide-info" class="w-3.5 h-3.5" />
              <span>Las fechas de salida anteriores al 26/05/2026 se registraron en bloque y no son fiables.</span>
            </p>

            <!-- Breakdowns -->
            <div ref="bdsEl" class="r-bds" :class="{ 'r-stale': loading && report }" @scroll.passive="onBdsScroll">
              <ReportsBreakdown
                :title="locationBreakdown.title" icon="i-lucide-map-pin" :items="locationBreakdown.items" :total="total"
                clickable hint="Toca para filtrar" @select="selectLocation"
              />
              <ReportsBreakdown
                title="Por vencimiento" icon="i-lucide-hourglass" :items="expiryItems" :total="total" :limit="7"
              />
              <ReportsBreakdown
                title="Por tier" icon="i-lucide-crown" :items="tierItems" :total="total"
                clickable @select="toggleIn('tier', $event)"
              />
              <ReportsBreakdown
                title="Por actividad" icon="i-lucide-activity" :items="engagementItems" :total="total"
                clickable @select="toggleIn('engagement', $event)"
              />
            </div>

            <div class="rm-dots" aria-hidden="true">
              <span v-for="i in 4" :key="i" :class="{ on: bdIndex === i - 1 }" />
            </div>
          </div>

          <div class="rm-pane" :class="{ 'rm-hidden': mTab !== 'usuarios' }" role="tabpanel">
            <!-- Results -->
            <ReportsTable
              :rows="rows" :loading="loading" :sort-by="filters.sortBy" :sort-dir="filters.sortDir"
              @patch="patch" @clear="reset"
            />
          </div>
          </template>
        </div>

        <ReportsExportBar v-if="!error" :total="total" :busy="busy" @export="onExport" />
      </div>
    </div>

    <!-- Filters overlay (below 1400px) -->
    <USlideover
      v-model:open="sheetOpen"
      :side="isPhone ? 'bottom' : 'right'"
      title="Filtros del reporte"
      description="Elige los filtros para generar el reporte"
      :ui="{ content: isPhone ? 'r-sheet-content r-sheet-bottom' : 'r-sheet-content r-sheet-right' }"
    >
      <template #content>
        <div class="r-sheet">
          <header class="r-sheet-head">
            <span v-if="isPhone" class="r-sheet-grab" aria-hidden="true" />
            <h3 class="r-bd-title"><UIcon name="i-lucide-filter" class="w-4 h-4" />Filtros</h3>
            <button type="button" class="stc-icon-btn" aria-label="Cerrar filtros" @click="sheetOpen = false">
              <UIcon name="i-lucide-x" class="w-4 h-4" />
            </button>
          </header>
          <div class="r-sheet-body stc-scroll">
            <ReportsFilters :filters="filters" :locations="locations" :admins="admins" @patch="patch" />
          </div>
          <footer class="r-sheet-foot">
            <button type="button" class="stc-btn" :disabled="!chips.length" @click="reset">Limpiar</button>
            <button type="button" class="stc-btn gold r-sheet-apply" @click="sheetOpen = false">
              <UIcon v-if="loading" name="i-lucide-loader-circle" class="w-4 h-4 animate-spin" />
              <template v-else>Ver {{ n(total) }} {{ total === 1 ? 'usuario' : 'usuarios' }}</template>
            </button>
          </footer>
        </div>
      </template>
    </USlideover>

    <!-- Móvil: hoja de exportación (sustituye a la barra inferior) -->
    <ClientOnly>
    <Teleport to="body">
      <Transition name="rm-fade">
        <div v-if="exportOpen" class="rm-backdrop" @click="exportOpen = false" />
      </Transition>
      <Transition name="rm-sheet">
        <div v-if="exportOpen" class="rm-sheet" role="dialog" aria-label="Exportar reporte">
          <span class="r-sheet-grab rm-grab" aria-hidden="true" />
          <div class="rm-sheet-title">Exportar reporte</div>
          <div class="rm-sheet-sub">{{ n(total) }} {{ total === 1 ? 'usuario' : 'usuarios' }} · {{ title }}</div>
          <button
            v-for="(f, i) in EXPORT_FORMATS" :key="f.id" type="button" class="rm-exp" :class="{ primary: i === 0 }"
            :disabled="!total || !!busy" @click="onExport(f.id)"
          >
            <UIcon :name="busy === f.id ? 'i-lucide-loader-circle' : f.icon" class="w-5 h-5" :class="[f.tone, { 'animate-spin': busy === f.id }]" />
            <span class="rm-exp-txt"><b>{{ f.label }}</b><span>{{ f.hint }}</span></span>
            <UIcon name="i-lucide-download" class="w-4 h-4 rm-exp-dl" />
          </button>
        </div>
      </Transition>
    </Teleport>
    </ClientOnly>
  </div>
</template>

<!-- Not scoped: these classes are shared with components/reports/* and with
     the filter sheet, which is teleported to <body>. Everything is r- prefixed. -->
<style>
/* ── Layout ─────────────────────────────────────────────── */
.r-page   { display: flex; flex-direction: column; gap: 18px; }
.r-title  {
  font-family: var(--disp); font-weight: 800; font-size: 24px; line-height: 1.12;
  letter-spacing: .004em; color: var(--text); margin-top: 6px; text-wrap: balance;
}
.r-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; }
.r-rail   { display: none; }
.r-main   { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
.r-results { display: flex; flex-direction: column; gap: 18px; min-width: 0; container: rresults / inline-size; }
.r-stale  { opacity: .55; transition: opacity .15s; }

@media (min-width: 768px) { .r-title { font-size: 30px; } }
@media (min-width: 1400px) {
  .r-layout { grid-template-columns: 312px minmax(0, 1fr); align-items: start; }
  .r-rail {
    display: block; position: sticky; top: 0;
    max-height: calc(100dvh - 128px); overflow-y: auto; padding: 16px 18px 20px;
  }
  .r-open-filters { display: none; }
}
.r-rail-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }

/* ── Shared bits ────────────────────────────────────────── */
.r-bd-title {
  display: flex; align-items: center; gap: 8px;
  font-family: var(--disp); font-size: 17px; font-weight: 700; letter-spacing: .02em;
  text-transform: uppercase; color: var(--text);
}
.r-bd-title .iconify { color: var(--gold); }
.r-link {
  font-family: var(--ui); font-size: 12.5px; font-weight: 500; color: var(--gold-soft);
  background: none; border: none; cursor: pointer; padding: 6px 8px; border-radius: 6px; white-space: nowrap;
}
.r-link:hover { background: var(--gold-wash); }
html:not(.dark) .r-link { color: var(--gold-dark); }
.r-count {
  font-size: 10.5px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px;
  background: var(--gold); color: var(--gold-ink); display: grid; place-items: center; font-weight: 700;
}

/* ── Toolbar: filter button + active chips ──────────────── */
.r-toolbar { display: flex; align-items: center; gap: 10px; min-width: 0; }
.r-toolbar:not(:has(.r-fchips)) { display: flex; }
.r-open-filters { flex-shrink: 0; min-height: 40px; }
.r-fchips {
  display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0;
  overflow-x: auto; scrollbar-width: none; padding: 2px 0;
  mask-image: linear-gradient(90deg, #000 calc(100% - 24px), transparent);
}
.r-fchips::-webkit-scrollbar { display: none; }
.r-fchip {
  display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
  font-family: var(--ui); font-size: 12.5px; font-weight: 500; white-space: nowrap;
  color: var(--gold-soft); background: var(--gold-wash); border: 1px solid var(--gold-ring);
  padding: 7px 9px 7px 12px; border-radius: 999px; cursor: pointer; transition: .14s;
}
.r-fchip:hover { background: rgba(234,157,19,.2); }
.r-fchip .iconify { opacity: .7; }
html:not(.dark) .r-fchip { color: var(--gold-dark); }
.r-fclear { flex-shrink: 0; margin-right: 20px; }
@media (min-width: 1400px) {
  .r-fchips { flex-wrap: wrap; overflow: visible; mask-image: none; }
  .r-toolbar:not(:has(.r-fchips)) { display: none; }
}

/* ── Presets ────────────────────────────────────────────── */
.r-presets {
  display: flex; align-items: center; gap: 7px; overflow-x: auto; scrollbar-width: none;
  margin: -4px 0; padding: 4px 0;
}
.r-presets::-webkit-scrollbar { display: none; }
.r-presets-lbl { margin-right: 3px; flex-shrink: 0; }
.r-preset {
  display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
  font-family: var(--ui); font-size: 12.5px; font-weight: 500; white-space: nowrap;
  color: var(--dim); background: var(--panel); border: 1px solid var(--line);
  padding: 8px 13px; border-radius: 999px; cursor: pointer; transition: .14s;
}
.r-preset:hover { color: var(--text); border-color: var(--line-2); }
.r-preset.on { color: var(--gold-ink); background: var(--gold); border-color: var(--gold); font-weight: 600; }

/* ── KPI tiles ──────────────────────────────────────────── */
.r-kpis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.r-kpis .stc-tile { padding: 14px 15px; gap: 9px; min-width: 0; }
.r-kpis .stc-tile-val { font-size: 34px; }
.r-kpis .stc-tile-head .lbl { letter-spacing: .1em; }
.r-tile-foot { font-size: 11.5px; color: var(--faint); }
@container rresults (min-width: 720px) {
  .r-kpis { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
  .r-kpis .stc-tile { padding: 18px 20px; gap: 12px; }
  .r-kpis .stc-tile-val { font-size: 44px; }
}

.r-note {
  display: flex; align-items: flex-start; gap: 9px; font-size: 12.5px; line-height: 1.45;
  color: var(--gold-soft); background: var(--gold-wash); border: 1px solid var(--gold-ring);
  border-radius: var(--r-sm); padding: 10px 13px;
}
.r-note .iconify { flex-shrink: 0; margin-top: 1px; }
.r-note.subtle { color: var(--faint); background: none; border: none; padding: 0 2px; margin-top: -8px; }
html:not(.dark) .r-note:not(.subtle) { color: var(--gold-dark); }

/* ── Breakdowns ─────────────────────────────────────────── */
.r-bds { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
@container rresults (min-width: 720px) { .r-bds { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.r-bd { padding: 15px 16px 12px; min-width: 0; }
.r-bd-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.r-bd-hint { font-size: 11px; color: var(--faint); white-space: nowrap; }
.r-bd-empty { font-size: 12.5px; color: var(--faint); padding: 14px 0; }
.r-bd-list { display: flex; flex-direction: column; gap: 2px; }
.r-bd-row {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 10px; align-items: baseline;
  width: 100%; text-align: left; padding: 8px 8px 9px; border-radius: var(--r-sm);
  background: none; border: 1px solid transparent; color: inherit; font: inherit;
}
.r-bd-row.clickable { cursor: pointer; transition: .14s; }
.r-bd-row.clickable:hover { background: rgba(255,255,255,.035); }
html:not(.dark) .r-bd-row.clickable:hover { background: rgba(0,0,0,.035); }
.r-bd-row.on { background: var(--gold-wash); border-color: var(--gold-ring); }
.r-bd-label { font-size: 13px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.r-bd-num { font-size: 12px; color: var(--faint); white-space: nowrap; }
.r-bd-num b { color: var(--text); font-weight: 600; }
.r-bd-bar { grid-column: 1 / -1; height: 5px; border-radius: 3px; background: var(--line); overflow: hidden; }
.r-bd-bar i { display: block; height: 100%; border-radius: 3px; transition: width .3s ease; }
.r-bd-bar.gold i    { background: linear-gradient(90deg, var(--gold-dark), var(--gold)); }
.r-bd-bar.green i   { background: var(--green); }
.r-bd-bar.red i     { background: var(--red); }
.r-bd-bar.blue i    { background: var(--blue); }
.r-bd-bar.neutral i { background: var(--faint); }
.r-bd-more { margin-top: 4px; font-size: 12px; color: var(--dim); background: none; border: none; cursor: pointer; padding: 8px; }
.r-bd-more:hover { color: var(--text); }

/* ── Results table ──────────────────────────────────────── */
.r-table { container: rtable / inline-size; min-width: 0; scroll-margin-top: 12px; }
.r-t-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  padding: 13px 18px; border-bottom: 1px solid var(--line);
}
.r-sort { display: flex; align-items: center; gap: 8px; }
.r-sort-sel { width: auto; min-height: 36px; padding: 6px 30px 6px 10px; font-size: 13px; }
.r-sort-dir .iconify { transition: transform .18s; }
.r-sort-dir.asc .iconify { transform: rotate(180deg); }
.r-sort-dir { width: 36px; height: 36px; }

.r-grid {
  display: grid; align-items: center; gap: 14px;
  grid-template-columns: minmax(170px, 2fr) 96px minmax(140px, 1.5fr) 96px minmax(130px, 1.2fr) 88px 74px;
}
.r-thead { padding: 12px 18px; border-bottom: 1px solid var(--line); }
.r-thead .stc-eyebrow { letter-spacing: .1em; }
.r-row {
  padding: 12px 18px; border-bottom: 1px solid var(--line); color: inherit; text-decoration: none;
  transition: background .14s;
}
.r-row:last-child { border-bottom: none; }
a.r-row:hover { background: rgba(255,255,255,.025); }
html:not(.dark) a.r-row:hover { background: rgba(0,0,0,.025); }
a.r-row:focus-visible { outline: 2px solid var(--gold-ring); outline-offset: -2px; }
.r-c-nums { display: contents; }
.r-c-num { text-align: right; font-size: 13px; color: var(--text); }
.r-num-lbl { display: none; }

.r-c-user { display: flex; align-items: center; gap: 11px; min-width: 0; }
.r-av {
  width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0; display: grid; place-items: center;
  font-family: var(--disp); font-weight: 800; font-size: 17px; color: #f0f0f0;
  border: 1px solid var(--line-2); overflow: hidden;
}
.r-av img { width: 100%; height: 100%; object-fit: cover; }
.r-uname { min-width: 0; }
.r-nm { font-size: 14px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.r-removed { font-size: 11px; color: var(--red); margin-top: 1px; }
.r-c-loc { min-width: 0; }
.r-loc-main { font-size: 13px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.r-loc-sub { font-size: 11.5px; color: var(--faint); margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.r-dash { font-size: 12.5px; color: var(--faint); }

.r-eng, .r-exp {
  display: inline-flex; align-items: center; font-size: 11px; font-weight: 600; line-height: 1.4;
  padding: 3px 9px; border-radius: var(--r-xs); border: 1px solid var(--line); white-space: nowrap;
}
.r-eng.active   { color: var(--green); background: var(--green-dim); border-color: var(--green-line); }
.r-eng.slipping { color: var(--gold-soft); background: var(--gold-wash); border-color: var(--gold-ring); }
.r-eng.inactive { color: var(--red); background: var(--red-dim); border-color: var(--red-line); }
.r-eng.dormant  { color: var(--faint); background: rgba(255,255,255,.04); }
.r-exp.expired  { color: var(--red); background: var(--red-dim); border-color: var(--red-line); }
.r-exp.soon     { color: var(--gold-soft); background: var(--gold-wash); border-color: var(--gold-ring); }
.r-exp.ok       { color: var(--dim); background: rgba(255,255,255,.04); }
.r-exp.none     { color: var(--faint); background: none; border-style: dashed; border-color: var(--line-2); }
html:not(.dark) .r-eng.slipping, html:not(.dark) .r-exp.soon { color: var(--gold-dark); }
html:not(.dark) .r-eng.dormant, html:not(.dark) .r-exp.ok { background: rgba(0,0,0,.04); }
.r-c-exp { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; min-width: 0; }
.r-exp-date { font-size: 11px; color: var(--faint); }

/* Narrow table: drop the two numeric columns */
@container rtable (max-width: 900px) {
  .r-grid { grid-template-columns: minmax(160px, 2fr) 90px minmax(130px, 1.4fr) 92px minmax(125px, 1.1fr); }
  .r-c-nums, .r-thead .r-c-num { display: none; }
}
/* Phone-width table: each row becomes a card */
@container rtable (max-width: 620px) {
  .r-thead { display: none; }
  .r-grid.r-row {
    grid-template-columns: minmax(0, 1fr) auto; gap: 9px 12px; padding: 14px 16px; align-items: center;
  }
  .r-c-user { grid-column: 1; grid-row: 1; }
  .r-c-tier { grid-column: 2; grid-row: 1; justify-self: end; }
  .r-c-loc  { grid-column: 1; grid-row: 2; }
  .r-c-exp  { grid-column: 2; grid-row: 2; align-items: flex-end; }
  .r-c-act  { grid-column: 1; grid-row: 3; }
  .r-c-nums { display: flex; gap: 14px; grid-column: 2; grid-row: 3; justify-self: end; }
  .r-c-num  { font-size: 12.5px; }
  .r-num-lbl { display: inline; color: var(--faint); margin-right: 5px; font-size: 11px; }
  .r-t-head { padding: 12px 16px; }
}

.r-pager { display: flex; align-items: center; justify-content: center; gap: 14px; padding: 14px 16px; border-top: 1px solid var(--line); }
.r-pbtn {
  width: 40px; height: 40px; display: grid; place-items: center; border-radius: var(--r-sm);
  color: var(--dim); border: 1px solid var(--line); background: transparent; cursor: pointer; transition: .14s;
}
.r-pbtn:hover:not(:disabled) { color: var(--text); border-color: var(--line-2); }
.r-pbtn:disabled { opacity: .35; cursor: not-allowed; }
.r-pinfo { font-size: 12.5px; color: var(--dim); }
.r-pinfo b { color: var(--text); font-weight: 600; }

/* ── Sticky export bar ──────────────────────────────────── */
.r-export {
  position: sticky; bottom: 0; z-index: 20;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 11px 14px; border-radius: var(--r); border: 1px solid var(--line-2);
  background: color-mix(in srgb, var(--panel) 90%, transparent);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 -10px 28px rgba(0,0,0,.35);
}
html:not(.dark) .r-export { box-shadow: 0 -8px 22px rgba(0,0,0,.08); }
.r-export-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.r-export-n { font-size: 13px; color: var(--dim); white-space: nowrap; }
.r-export-n b { color: var(--text); font-weight: 600; }
.r-export-btns { display: flex; gap: 8px; }
.r-export-btns .stc-btn { min-height: 40px; }
/* Móvil: la barra quedaba tapada por la píldora de navegación; la exportación
   pasa a la hoja que abre el botón de compartir de la barra de herramientas. */
@media (max-width: 767px) {
  .r-export { display: none; }
}

/* ── Filter form ────────────────────────────────────────── */
.r-form  { display: flex; flex-direction: column; gap: 20px; }
.r-group { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.r-input {
  width: 100%; min-height: 40px; font-family: var(--ui); font-size: 13.5px; color: var(--text);
  background: var(--inset); border: 1px solid var(--line); border-radius: var(--r-sm);
  padding: 8px 11px; outline: none; transition: .14s; color-scheme: dark;
}
html:not(.dark) .r-input { color-scheme: light; }
.r-input::placeholder { color: var(--faint); }
.r-input:focus-visible { border-color: var(--gold-ring); box-shadow: 0 0 0 3px var(--gold-wash); }
.r-input:disabled { opacity: .45; cursor: not-allowed; }
.r-select { cursor: pointer; text-overflow: ellipsis; }
.r-select.set { border-color: var(--gold-ring); background: var(--gold-wash); }
.r-search { position: relative; }
.r-search-ico { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: var(--faint); pointer-events: none; }
.r-search .r-input { padding-left: 35px; }
.r-pair  { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.r-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.r-field label { font-size: 11.5px; color: var(--dim); }

.r-chips { display: flex; flex-wrap: wrap; gap: 7px; }
.r-chip {
  display: inline-flex; align-items: center; gap: 6px; min-height: 36px;
  font-family: var(--ui); font-size: 13px; font-weight: 500; white-space: nowrap;
  color: var(--dim); background: transparent; border: 1px solid var(--line);
  padding: 6px 13px; border-radius: 999px; cursor: pointer; transition: .14s;
}
.r-chip:hover { color: var(--text); border-color: var(--line-2); }
.r-chip small { font-size: 11px; font-weight: 400; color: var(--faint); }
.r-tick { width: 14px; height: 14px; margin: 0 -1px 0 -4px; display: none; }
.r-chip.on { color: var(--gold-soft); background: var(--gold-wash); border-color: var(--gold-ring); }
.r-chip.on .r-tick { display: inline-block; }
.r-chip.on small { color: inherit; opacity: .75; }
.r-chip.on.delta { color: var(--blue); background: var(--blue-dim); border-color: var(--blue-line); }
html:not(.dark) .r-chip.on:not(.delta) { color: var(--gold-dark); }

.r-seg { display: flex; border: 1px solid var(--line); border-radius: var(--r-sm); overflow: hidden; }
.r-seg button {
  flex: 1; min-height: 38px; font-family: var(--ui); font-size: 12.5px; font-weight: 500; color: var(--dim);
  padding: 7px 8px; background: transparent; border: none; border-right: 1px solid var(--line);
  cursor: pointer; transition: .14s; white-space: nowrap;
}
.r-seg button:last-child { border-right: none; }
.r-seg button:hover { color: var(--text); }
.r-seg button.on { color: var(--gold-ink); font-weight: 600; background: var(--gold); }

.r-more { border-top: 1px solid var(--line); padding-top: 6px; }
.r-more summary {
  display: flex; align-items: center; gap: 8px; min-height: 44px; cursor: pointer; list-style: none;
  font-size: 13px; font-weight: 600; color: var(--text);
}
.r-more summary::-webkit-details-marker { display: none; }
.r-more summary .iconify:first-child { color: var(--gold); }
.r-more-chev { margin-left: auto; color: var(--faint); transition: transform .18s; }
.r-more[open] .r-more-chev { transform: rotate(180deg); }
.r-more[open] { display: flex; flex-direction: column; gap: 20px; }
.r-more[open] summary { margin-bottom: -8px; }

/* ── Filter sheet (USlideover content) ──────────────────── */
.r-sheet-content { background: var(--panel) !important; border-color: var(--line-2) !important; }
.r-sheet-bottom { max-height: 88dvh; border-radius: 16px 16px 0 0; overflow: hidden; }
.r-sheet-right  { width: 100%; max-width: 400px; }
.r-sheet { display: flex; flex-direction: column; min-height: 0; height: 100%; max-height: inherit; flex: 1; }
.r-sheet-head {
  position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 16px 16px 12px 18px; border-bottom: 1px solid var(--line); flex-shrink: 0;
}
.r-sheet-grab { position: absolute; top: 7px; left: 50%; width: 38px; height: 4px; margin-left: -19px; border-radius: 2px; background: var(--line-2); }
.r-sheet-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 18px 18px 22px; }
.r-sheet-foot {
  display: flex; gap: 10px; flex-shrink: 0; border-top: 1px solid var(--line); background: var(--panel);
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
}
.r-sheet-foot .stc-btn { min-height: 46px; font-size: 14px; }
.r-sheet-apply { flex: 1; }

/* Phones: 16px inputs (no iOS zoom on focus) and 44px tap targets */
@media (max-width: 767px) {
  .r-input { font-size: 16px; min-height: 46px; }
  .r-sort-sel { font-size: 14px; min-height: 40px; }
  .r-chip { min-height: 42px; padding: 8px 15px; font-size: 14px; }
  .r-seg button { min-height: 44px; font-size: 13.5px; }
  .r-preset { padding: 10px 14px; font-size: 13px; }
  .r-fchip { padding: 9px 10px 9px 13px; font-size: 13px; }
  .r-bd-row { padding: 10px 8px 11px; }
}

/* ══ Móvil (<768px): pestañas, carrusel, lista compacta, exportar ══ */
.rm-share, .rm-tabs, .rm-dots, .rm-list { display: none; }
.rm-pane { display: contents; }

@media (max-width: 767px) {
  .r-head { display: none; }
  .r-page, .r-main, .r-results { gap: 14px; }

  .rm-share {
    display: inline-flex; flex-shrink: 0; margin-left: auto;
    min-width: 40px; min-height: 40px; padding: 0; justify-content: center;
  }
  .r-fclear { margin-right: 4px; }

  .rm-tabs { display: flex; }
  .rm-tabs button {
    flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    min-height: 40px; font-size: 13.5px;
  }
  .rm-tab-n {
    font-size: 11.5px; padding: 1px 6px; border-radius: 999px;
    background: var(--line); color: var(--dim);
  }
  .rm-tabs button.on .rm-tab-n { background: rgba(0,0,0,.18); color: var(--gold-ink); }

  .rm-pane.rm-hidden { display: none; }

  /* KPIs más compactos */
  .r-kpis { gap: 10px; }
  .r-kpis .stc-tile { padding: 12px 13px; gap: 6px; }
  .r-kpis .stc-tile-val { font-size: 30px; }
  .r-kpis .stc-tile-head .lbl { font-size: 9.5px; }

  /* Desgloses: carrusel horizontal con snap */
  .r-bds {
    display: flex; gap: 12px; align-items: flex-start;
    margin: 0 -16px; padding: 0 16px;
    overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding: 0 16px;
    scrollbar-width: none; overscroll-behavior-x: contain;
  }
  .r-bds::-webkit-scrollbar { display: none; }
  .r-bds > .r-bd { flex: 0 0 86%; scroll-snap-align: start; min-width: 0; }
  .rm-dots { display: flex; justify-content: center; gap: 5px; margin-top: -4px; }
  .rm-dots span { width: 6px; height: 6px; border-radius: 999px; background: var(--line-2); transition: width .2s, background .2s; }
  .rm-dots span.on { width: 18px; background: var(--gold); }

  /* Lista: sustituye a la tabla y al paginador */
  .r-table .r-thead, .r-table .r-rows, .r-table .r-pager { display: none; }
  .rm-list { display: block; }
  .rm-row {
    display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 10px 14px;
    border-top: 1px solid var(--line); color: inherit; text-decoration: none;
    -webkit-tap-highlight-color: transparent;
  }
  .rm-row:first-child { border-top: 0; }
  .rm-row:active { background: var(--panel-2); }
  .rm-av { width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0; }
  .rm-body { flex: 1; min-width: 0; }
  .rm-name {
    display: flex; align-items: center; gap: 6px; min-width: 0;
    font-size: 15px; font-weight: 600; color: var(--text); line-height: 1.25;
  }
  .rm-tier { flex-shrink: 0; padding: 1px 6px; border-radius: 5px; font-size: 10.5px; font-weight: 600; }
  .rm-tier.alpha { color: var(--gold-soft); background: var(--gold-wash); }
  .rm-tier.delta { color: var(--blue); background: var(--blue-dim); }
  .rm-tier.removed { color: var(--red); background: var(--red-dim); }
  .rm-sub {
    display: flex; align-items: center; gap: 6px; min-width: 0; margin-top: 3px;
    font-size: 12.5px; color: var(--faint); white-space: nowrap;
  }
  .rm-sep { color: var(--line-2); }
  .r-eng-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: var(--faint); }
  .r-eng-dot.active   { background: var(--green); }
  .r-eng-dot.slipping { background: var(--gold); }
  .r-eng-dot.inactive { background: var(--red); }

  .rm-due { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
  .rm-due b { font-size: 13.5px; font-weight: 600; color: var(--dim); }
  .rm-due span { font-size: 11px; color: var(--faint); }
  .rm-due.soon b    { color: var(--gold-soft); }
  .rm-due.expired b { color: var(--red); }
  .rm-due.none b    { color: var(--faint); font-weight: 500; }
  html:not(.dark) .rm-due.soon b { color: var(--gold-dark); }
  .rm-more { display: flex; justify-content: center; padding: 14px; border-top: 1px solid var(--line); }

  .r-t-head { padding: 12px 14px; }
}

/* Hoja de exportación (teletransportada a body) */
.rm-backdrop { position: fixed; inset: 0; z-index: 70; background: rgba(0,0,0,.6); }
.rm-sheet {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 75;
  display: flex; flex-direction: column; gap: 8px;
  padding: 10px 16px calc(18px + env(safe-area-inset-bottom));
  background: var(--panel); border-top: 1px solid var(--line-2); border-radius: 20px 20px 0 0;
}
.rm-grab { display: block; margin: 0 auto 6px; }
.rm-sheet-title { font-family: var(--disp); font-size: 22px; font-weight: 700; text-transform: uppercase; color: var(--text); }
.rm-sheet-sub { font-size: 13px; color: var(--faint); margin: -4px 0 6px; }
.rm-exp {
  display: flex; align-items: center; gap: 12px; width: 100%; min-height: 58px; padding: 10px 14px;
  border-radius: 12px; border: 1px solid var(--line-2); background: var(--panel-2);
  color: var(--text); font-family: var(--ui); text-align: left; cursor: pointer;
}
.rm-exp.primary { border-color: var(--gold-ring); background: var(--gold-wash); }
.rm-exp:disabled { opacity: .5; cursor: not-allowed; }
.rm-exp .gold  { color: var(--gold); }
.rm-exp .green { color: var(--green); }
.rm-exp .dim   { color: var(--dim); }
.rm-exp-txt { flex: 1; display: flex; flex-direction: column; gap: 1px; }
.rm-exp-txt b { font-size: 14.5px; font-weight: 600; }
.rm-exp-txt span { font-size: 12px; color: var(--faint); }
.rm-exp-dl { color: var(--faint); }
.rm-fade-enter-active, .rm-fade-leave-active { transition: opacity .2s; }
.rm-fade-enter-from, .rm-fade-leave-to { opacity: 0; }
.rm-sheet-enter-active, .rm-sheet-leave-active { transition: transform .26s cubic-bezier(.2,.8,.2,1); }
.rm-sheet-enter-from, .rm-sheet-leave-to { transform: translateY(100%); }
</style>
