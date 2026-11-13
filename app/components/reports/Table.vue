<script setup lang="ts">
import {
  ENGAGEMENT_LABELS,
  SORT_OPTIONS,
  TIER_LABELS,
  countryName,
  type ReportFilters,
  type ReportRow,
  type SortBy,
} from '#shared/reports'
import { formatDay } from '~/utils/reportExport/columns'

const props = defineProps<{
  rows: ReportRow[]
  loading: boolean
  sortBy: SortBy
  sortDir: 'asc' | 'desc'
}>()
const emit = defineEmits<{ patch: [p: Partial<ReportFilters>]; clear: [] }>()

const PAGE_SIZE = 25
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(props.rows.length / PAGE_SIZE)))
const pageRows = computed(() => props.rows.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
watch(() => props.rows, () => { page.value = 1 })

const top = ref<HTMLElement>()
function go(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
  top.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function setSort(v: SortBy) {
  emit('patch', { sortBy: v, sortDir: SORT_OPTIONS.find(o => o.value === v)!.dir })
}

const AV = [['#3a2a05', '#6b4a08'], ['#0d2a3a', '#14506b'], ['#2a0d3a', '#4f1a6b'], ['#0d3a1f', '#146b3a'], ['#3a0d14', '#6b1a26']]
function avatarGrad(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const [a, b] = AV[h % AV.length]!
  return `linear-gradient(150deg, ${a}, ${b})`
}
const initial = (name: string) => name.replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase() || '?'

function place(r: ReportRow) {
  const l = r.location
  if (!l.country) return null
  return { main: l.city ?? l.region ?? countryName(l.country), sub: [l.city ? l.region : null, countryName(l.country)].filter(Boolean).join(', '), flag: countryFlag(l.country) }
}

// ── Móvil: scroll infinito de 30 en 30 ──
const MOBILE_STEP = 30
const mobileLimit = ref(MOBILE_STEP)
const mobileRows = computed(() => props.rows.slice(0, mobileLimit.value))
watch(() => props.rows, () => { mobileLimit.value = MOBILE_STEP })
function loadMore() {
  if (mobileLimit.value < props.rows.length) mobileLimit.value += MOBILE_STEP
}
// El centinela se vuelve a montar tras cada carga (key = límite) para que
// el observer dispare otra vez si sigue visible.
const sentinel = ref<HTMLElement | null>(null)
let io: IntersectionObserver | null = null
onMounted(() => {
  io = new IntersectionObserver(
    entries => { if (entries[0]?.isIntersecting) loadMore() },
    { root: document.querySelector('.stc-scroll'), rootMargin: '400px 0px' },
  )
  watch(sentinel, (el, old) => {
    if (old) io?.unobserve(old)
    if (el) io?.observe(el)
  }, { immediate: true })
})
onBeforeUnmount(() => io?.disconnect())

// "23 d", "Hoy", "-5 d" para la columna de vencimiento.
function shortExpiry(r: ReportRow) {
  const d = r.membership.daysLeft
  if (d === null) return '—'
  if (d === 0) return 'Hoy'
  return `${d} d`
}

function expiry(r: ReportRow) {
  const d = r.membership.daysLeft
  if (d === null) return { cls: 'none', text: 'Sin dato', date: '' }
  const date = formatDay(r.membership.expiresAt)
  if (d < 0) return { cls: 'expired', text: d === -1 ? 'Venció ayer' : `Venció hace ${-d} días`, date }
  const text = d === 0 ? 'Vence hoy' : d === 1 ? 'Vence mañana' : `En ${d} días`
  return { cls: d <= 30 ? 'soon' : 'ok', text, date }
}
</script>

<template>
  <section ref="top" class="stc-panel r-table">
    <header class="r-t-head">
      <h3 class="r-bd-title"><UIcon name="i-lucide-users" class="w-4 h-4" />Usuarios</h3>
      <div class="r-sort">
        <label class="stc-eyebrow" for="r-sort">Ordenar</label>
        <select id="r-sort" class="r-input r-select r-sort-sel" :value="sortBy" @change="setSort(($event.target as HTMLSelectElement).value as SortBy)">
          <option v-for="o in SORT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <button
          type="button" class="stc-icon-btn r-sort-dir" :class="{ asc: sortDir === 'asc' }"
          :aria-label="sortDir === 'asc' ? 'Orden ascendente' : 'Orden descendente'"
          :title="sortDir === 'asc' ? 'Ascendente' : 'Descendente'"
          @click="emit('patch', { sortDir: sortDir === 'asc' ? 'desc' : 'asc' })"
        >
          <UIcon name="i-lucide-arrow-down" class="w-4 h-4" />
        </button>
      </div>
    </header>

    <div class="r-grid r-thead">
      <div class="stc-eyebrow">Usuario</div>
      <div class="stc-eyebrow">Tier</div>
      <div class="stc-eyebrow">Ubicación</div>
      <div class="stc-eyebrow">Actividad</div>
      <div class="stc-eyebrow">Vence</div>
      <div class="stc-eyebrow r-c-num">Reuniones</div>
      <div class="stc-eyebrow r-c-num">Msj 30d</div>
    </div>

    <div v-if="loading && !rows.length">
      <div v-for="i in 8" :key="i" class="r-grid r-row">
        <div class="r-c-user"><USkeleton class="w-9 h-9 rounded-lg flex-shrink-0" /><USkeleton class="h-3.5 w-32" /></div>
        <div class="r-c-tier"><USkeleton class="h-5 w-14 rounded-md" /></div>
        <div class="r-c-loc"><USkeleton class="h-3.5 w-28" /></div>
        <div class="r-c-act"><USkeleton class="h-5 w-16 rounded-md" /></div>
        <div class="r-c-exp"><USkeleton class="h-5 w-24 rounded-md" /></div>
        <div class="r-c-nums">
          <div class="r-c-num"><USkeleton class="h-3.5 w-6 ml-auto" /></div>
          <div class="r-c-num"><USkeleton class="h-3.5 w-6 ml-auto" /></div>
        </div>
      </div>
    </div>

    <div v-else-if="!rows.length" class="stc-empty">
      <UIcon name="i-lucide-search-x" class="w-7 h-7" />
      <p>Ningún usuario coincide con estos filtros.</p>
      <button type="button" class="stc-btn sm gold-soft" @click="emit('clear')">
        <UIcon name="i-lucide-rotate-ccw" class="w-3.5 h-3.5" />Limpiar filtros
      </button>
    </div>

    <!-- Móvil (<768px): lista compacta con scroll infinito -->
    <template v-else>
    <div class="rm-list" :class="{ 'r-stale': loading }">
      <NuxtLink v-for="r in mobileRows" :key="r._id" :to="`/discord-users/${r._id}`" class="rm-row">
        <div class="r-av rm-av" :style="r.avatarUrl ? {} : { background: avatarGrad(r.username) }">
          <img v-if="r.avatarUrl" :src="r.avatarUrl" alt="" loading="lazy">
          <template v-else>{{ initial(r.username) }}</template>
        </div>
        <div class="rm-body">
          <div class="rm-name">
            <span class="truncate">{{ r.username }}</span>
            <span v-if="r.tier !== 'none'" class="rm-tier" :class="r.tier">{{ TIER_LABELS[r.tier] }}</span>
            <span v-if="r.memberStatus === 'removed'" class="rm-tier removed">Eliminado</span>
          </div>
          <div class="rm-sub">
            <span class="r-eng-dot" :class="r.engagement" />
            <span>{{ ENGAGEMENT_LABELS[r.engagement] }}</span>
            <template v-if="place(r)"><span class="rm-sep">·</span><span class="truncate">{{ place(r)!.flag }} {{ place(r)!.main }}</span></template>
          </div>
        </div>
        <div class="rm-due" :class="expiry(r).cls">
          <b class="stc-mono">{{ shortExpiry(r) }}</b>
          <span v-if="expiry(r).date" class="stc-mono">{{ expiry(r).date }}</span>
        </div>
      </NuxtLink>
      <div v-if="mobileLimit < rows.length" :key="mobileLimit" ref="sentinel" class="rm-more">
        <button type="button" class="stc-btn sm" @click="loadMore">Cargar más</button>
      </div>
    </div>

    <div class="r-rows" :class="{ 'r-stale': loading }">
      <NuxtLink v-for="r in pageRows" :key="r._id" :to="`/discord-users/${r._id}`" class="r-grid r-row">
        <div class="r-c-user">
          <div class="r-av" :style="r.avatarUrl ? {} : { background: avatarGrad(r.username) }">
            <img v-if="r.avatarUrl" :src="r.avatarUrl" alt="" loading="lazy">
            <template v-else>{{ initial(r.username) }}</template>
          </div>
          <div class="r-uname">
            <div class="r-nm">{{ r.username }}</div>
            <div v-if="r.memberStatus === 'removed'" class="r-removed">Eliminado</div>
          </div>
        </div>

        <div class="r-c-tier">
          <span class="stc-badge" :class="r.tier === 'alpha' ? 'gold' : r.tier === 'delta' ? 'blue' : 'outline'">
            {{ r.tierRole ?? TIER_LABELS[r.tier] }}
          </span>
        </div>

        <div class="r-c-loc">
          <template v-if="place(r)">
            <div class="r-loc-main">{{ place(r)!.flag }} {{ place(r)!.main }}</div>
            <div class="r-loc-sub">{{ place(r)!.sub }}</div>
          </template>
          <span v-else class="r-dash">Sin ubicación</span>
        </div>

        <div class="r-c-act">
          <span class="r-eng" :class="r.engagement">{{ ENGAGEMENT_LABELS[r.engagement] }}</span>
        </div>

        <div class="r-c-exp">
          <span class="r-exp" :class="expiry(r).cls">{{ expiry(r).text }}</span>
          <span v-if="expiry(r).date" class="r-exp-date stc-mono">{{ expiry(r).date }}</span>
        </div>

        <div class="r-c-nums">
          <div class="r-c-num stc-mono"><span class="r-num-lbl">Reuniones</span>{{ r.meetingCount.toLocaleString('es-ES') }}</div>
          <div class="r-c-num stc-mono"><span class="r-num-lbl">Msj 30d</span>{{ r.messages30d.toLocaleString('es-ES') }}</div>
        </div>
      </NuxtLink>
    </div>
    </template>

    <footer v-if="rows.length > PAGE_SIZE" class="r-pager">
      <button type="button" class="r-pbtn" :disabled="page === 1" aria-label="Página anterior" @click="go(page - 1)">
        <UIcon name="i-lucide-chevron-left" class="w-4 h-4" />
      </button>
      <span class="r-pinfo stc-mono">
        <b>{{ ((page - 1) * PAGE_SIZE + 1).toLocaleString('es-ES') }}–{{ Math.min(page * PAGE_SIZE, rows.length).toLocaleString('es-ES') }}</b>
        de {{ rows.length.toLocaleString('es-ES') }}
      </span>
      <button type="button" class="r-pbtn" :disabled="page === totalPages" aria-label="Página siguiente" @click="go(page + 1)">
        <UIcon name="i-lucide-chevron-right" class="w-4 h-4" />
      </button>
    </footer>
  </section>
</template>
