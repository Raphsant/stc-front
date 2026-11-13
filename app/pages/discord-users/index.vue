<script setup lang="ts">
useSeoMeta({
  title: 'Usuarios - STC Control',
  description: 'Directorio de miembros del Discord del Stock Trading Club.',
  ogTitle: 'Usuarios de Discord - STC Control',
})

const { getEngagementState, formatRelativeTime } = useEngagementState()

// ── filter state ──────────────────────────────────────────
const q             = ref('')
const selectedRoles = ref<string[]>([])   // 'alpha' | 'delta' | 'ninguno'
const noMeetings    = ref(false)
type EstadoFilter   = 'todos' | 'activos' | 'eliminados'
const estado        = ref<EstadoFilter>('activos')
type OrdenKey       = 'recent' | 'meetings' | 'messages30d' | 'lifetime' | 'joinedAt'
const orden         = ref<OrdenKey>('recent')
const dir           = ref<'asc' | 'desc'>('desc')
const dateFrom      = ref('')
const dateTo        = ref('')
const page          = ref(1)
const popoverOpen   = ref(false)
// Location: country code | 'none' (sin ubicación); region/city are stcbot's normalized keys.
const country       = ref('')
const region        = ref('')
const city          = ref('')

const sortableKeys = new Set<OrdenKey>(['meetings', 'messages30d', 'lifetime', 'joinedAt'])
const sortDirDisabled = computed(() => !sortableKeys.has(orden.value))

const sortDirLabel = computed(() =>
  dir.value === 'asc' ? 'Menor a mayor' : 'Mayor a menor',
)

const periodoCount = computed(() => (dateFrom.value ? 1 : 0) + (dateTo.value ? 1 : 0))

const estadoToStatus: Record<EstadoFilter, string | undefined> = {
  todos: undefined,
  activos: 'active',
  eliminados: 'removed',
}

const ordenToSortBy: Record<OrdenKey, string> = {
  recent: 'recent',
  meetings: 'meetings',
  messages30d: 'messages30d',
  lifetime: 'lifetime',
  joinedAt: 'joinedAt',
}

// ── data fetches ──────────────────────────────────────────
const { data: totalCount } = await useFetch('/api/discord-users/count', { lazy: true })

const { data: users, pending } = useFetch('/api/discord-users', {
  query: computed(() => ({
    ...(q.value ? { q: q.value } : {}),
    ...(estadoToStatus[estado.value] ? { status: estadoToStatus[estado.value] } : {}),
    sortBy: ordenToSortBy[orden.value],
    sortDir: dir.value,
    ...(dateFrom.value ? { from: dateFrom.value } : {}),
    ...(dateTo.value   ? { to:   dateTo.value   } : {}),
    ...(country.value  ? { country: country.value } : {}),
    ...(region.value   ? { region:  region.value  } : {}),
    ...(city.value     ? { city:    city.value    } : {}),
  })),
  default: () => [],
})

// Counts follow the Estado filter so the dropdowns match the list.
const { data: locations } = useFetch('/api/discord-users/locations', {
  query: computed(() => (estadoToStatus[estado.value] ? { status: estadoToStatus[estado.value] } : {})),
  lazy: true,
  default: () => ({ noneCount: 0, countries: [] as any[] }),
})

// ISO code → "🇪🇸 España", using the browser's own country names.
const countryNames = new Intl.DisplayNames(['es'], { type: 'region' })
function countryLabel(code: string) {
  const flag = String.fromCodePoint(...[...code].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
  let name = code
  try { name = countryNames.of(code) ?? code } catch {}
  return `${flag} ${name}`
}

const selectedCountry = computed(() => locations.value?.countries.find((c: any) => c.code === country.value))
const regionOptions   = computed(() => selectedCountry.value?.regions ?? [])
const cityOptions     = computed(() => regionOptions.value.find((r: any) => r.key === region.value)?.cities ?? [])

function setCountry(v: string) {
  country.value = v
  region.value  = ''
  city.value    = ''
}
function setRegion(v: string) {
  region.value = v
  city.value   = ''
}

// ── client-side filters ───────────────────────────────────
function classifyRole(role: string): 'alpha' | 'delta' | 'other' {
  const r = role.toLowerCase().replace(/[^a-z]/g, '')
  if (r.includes('alpha')) return 'alpha'
  if (r.includes('delta')) return 'delta'
  return 'other'
}

const filteredRows = computed(() => {
  return (users.value || []).filter((user: any) => {
    if (noMeetings.value && (user.meetingCount ?? 0) !== 0) return false
    if (selectedRoles.value.length > 0) {
      const roleSet = new Set(selectedRoles.value)
      const roles   = user.roles || []
      const hasAlpha = roles.some((r: string) => classifyRole(r) === 'alpha')
      const hasDelta = roles.some((r: string) => classifyRole(r) === 'delta')
      const hasNone  = !hasAlpha && !hasDelta
      const match =
        (roleSet.has('alpha')   && hasAlpha) ||
        (roleSet.has('delta')   && hasDelta) ||
        (roleSet.has('ninguno') && hasNone)
      if (!match) return false
    }
    return true
  })
})

// ── pagination ────────────────────────────────────────────
const PAGE_SIZE   = 10
const totalPages  = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / PAGE_SIZE)))
const paginatedRows = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filteredRows.value.slice(start, start + PAGE_SIZE)
})

function visiblePages(cur: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const out: (number | '...')[] = [1]
  if (cur > 3) out.push('...')
  for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) out.push(i)
  if (cur < total - 2) out.push('...')
  out.push(total)
  return out
}

// ── filter actions ────────────────────────────────────────
const filtersActive = computed(() =>
  !!(q.value || selectedRoles.value.length || noMeetings.value ||
     estado.value !== 'activos' || orden.value !== 'recent' ||
     dateFrom.value || dateTo.value || country.value),
)

function toggleRole(role: string) {
  const idx = selectedRoles.value.indexOf(role)
  if (idx === -1) selectedRoles.value = [...selectedRoles.value, role]
  else             selectedRoles.value = selectedRoles.value.filter(r => r !== role)
  page.value = 1
}

function setEstado(v: EstadoFilter) {
  estado.value = v
  page.value = 1
}

function setOrden(key: OrdenKey) {
  orden.value = key
  if (!sortableKeys.has(key)) dir.value = 'desc'
  page.value = 1
}

function toggleDir() {
  if (sortDirDisabled.value) return
  dir.value = dir.value === 'asc' ? 'desc' : 'asc'
  page.value = 1
}

function clearAll() {
  q.value             = ''
  selectedRoles.value = []
  noMeetings.value    = false
  estado.value        = 'activos'
  orden.value         = 'recent'
  dir.value           = 'desc'
  dateFrom.value      = ''
  dateTo.value        = ''
  setCountry('')
  page.value          = 1
  popoverOpen.value   = false
}

function togglePopover(e: MouseEvent) {
  e.stopPropagation()
  popoverOpen.value = !popoverOpen.value
}

onMounted(() => {
  document.addEventListener('click', () => { popoverOpen.value = false })
})

// reset page on server-side filter changes
watch([q, estado, orden, dir, dateFrom, dateTo, country, region, city], () => { page.value = 1 })

// ── user display helpers ──────────────────────────────────
// Tonos profundos y desaturados — distinguibles al escanear la lista
// sin romper la paleta negro + dorado de la marca.
const AV_COLORS: [string, string][] = [
  ['#3a2c10','#241a08'], ['#2a2a2e','#161618'], ['#12302a','#0a1c18'],
  ['#331a1e','#1e0e11'], ['#2b2a12','#19180a'], ['#1a2438','#0e1522'],
  ['#2e2438','#1a1422'], ['#33280f','#1f1808'], ['#123033','#0a1c1e'],
]
function avatarGrad(name: string) {
  let h = 0
  for (const c of name) h = ((h * 31 + c.charCodeAt(0)) >>> 0)
  const [a, b] = AV_COLORS[h % AV_COLORS.length]!
  return `linear-gradient(150deg, ${a}, ${b})`
}

function displayRoles(user: any) {
  const roles  = user.roles || []
  const labeled: { label: string; type: 'alpha' | 'delta' }[] = []
  let   extra  = 0
  for (const role of roles) {
    const t = classifyRole(role)
    if (t === 'other') extra++
    else labeled.push({ label: role, type: t })
  }
  return { labeled, extra }
}

function lastActiveDate(user: any): Date | null {
  const msg = user.lastMessageAt ? new Date(user.lastMessageAt).getTime() : 0
  const mtg = user.lastMeetingAt ? new Date(user.lastMeetingAt).getTime() : 0
  const max = Math.max(msg, mtg)
  return max ? new Date(max) : null
}

function isOnline(user: any): boolean {
  return getEngagementState(user.lastMessageAt, user.lastMeetingAt).state === 'active'
}

function activityBadge(user: any): { text: string; cls: string } {
  const date = lastActiveDate(user)
  if (!date) return { text: 'Sin actividad', cls: 'badge-dormant' }
  const { state } = getEngagementState(user.lastMessageAt, user.lastMeetingAt)
  return {
    text: formatRelativeTime(date),
    cls: state === 'active'    ? 'badge-active'
       : state === 'slipping'  ? 'badge-slipping'
       : state === 'inactive'  ? 'badge-inactive'
       : 'badge-dormant',
  }
}

function memberSince(user: any): string {
  if (!user.joinedAt) return 'desconocido'
  return formatRelativeTime(user.joinedAt).replace(/^hace /, '')
}

function goPrev() { if (page.value > 1)              page.value-- }
function goNext() { if (page.value < totalPages.value) page.value++ }

// ── Móvil (<768px): lista compacta ────────────────────────
// Usa el mismo estado de filtros y datos que la tabla de escritorio;
// el CSS decide cuál se ve, así SSR y cliente renderizan lo mismo.
const sheetOpen = ref(false)

const ORDEN_LABELS: Record<OrdenKey, string> = {
  recent: 'Recientes',
  meetings: 'Reuniones',
  messages30d: 'Mensajes 30d',
  lifetime: 'Mensajes total',
  joinedAt: 'Antigüedad',
}

// Filtros que viven en la hoja (los chips rápidos también cuentan).
const sheetFilterCount = computed(() =>
  selectedRoles.value.length + (noMeetings.value ? 1 : 0) +
  (estado.value !== 'activos' ? 1 : 0) + (country.value ? 1 : 0) +
  periodoCount.value + (orden.value !== 'recent' ? 1 : 0),
)

// Scroll infinito: se muestran de 30 en 30.
const MOBILE_STEP = 30
const mobileLimit = ref(MOBILE_STEP)
const mobileRows  = computed(() => filteredRows.value.slice(0, mobileLimit.value))
const hasMoreMobile = computed(() => mobileLimit.value < filteredRows.value.length)
watch(filteredRows, () => { mobileLimit.value = MOBILE_STEP })

function loadMoreMobile() {
  if (hasMoreMobile.value) mobileLimit.value += MOBILE_STEP
}

// El centinela se vuelve a montar (key = límite) tras cada carga, así el
// observer dispara de nuevo si sigue visible.
const sentinel = ref<HTMLElement | null>(null)
let io: IntersectionObserver | null = null
onMounted(() => {
  io = new IntersectionObserver(
    entries => { if (entries[0]?.isIntersecting) loadMoreMobile() },
    { root: document.querySelector('.stc-scroll'), rootMargin: '400px 0px' },
  )
  watch(sentinel, (el, old) => {
    if (old) io?.unobserve(old)
    if (el) io?.observe(el)
  }, { immediate: true })
})
onBeforeUnmount(() => io?.disconnect())

// "3 h", "ayer", "5 d"… para la columna de tiempo de la fila.
function shortAgo(user: any): string {
  const date = lastActiveDate(user)
  if (!date) return '—'
  const mins = Math.floor((Date.now() - date.getTime()) / 60000)
  if (mins < 60) return 'ahora'
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ayer'
  if (days < 30) return `${days} d`
  if (days < 365) return `${Math.floor(days / 30)} m`
  return `${Math.floor(days / 365)} a`
}

function roleTypes(user: any): ('alpha' | 'delta')[] {
  const types = new Set(displayRoles(user).labeled.map(r => r.type))
  return (['alpha', 'delta'] as const).filter(t => types.has(t))
}

// ── Deslizar para acciones ──
const SWIPE_W = 136
const openSwipeId = ref<string | null>(null)
const drag = reactive({ id: '' as string, x0: 0, y0: 0, base: 0, dx: 0, axis: '' as '' | 'x' | 'y' })
let justSwiped = false

function rowOffset(id: string) {
  if (drag.id === id && drag.axis === 'x') return drag.dx
  return openSwipeId.value === id ? -SWIPE_W : 0
}

function onRowDown(e: PointerEvent, id: string) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  if (openSwipeId.value && openSwipeId.value !== id) openSwipeId.value = null
  drag.id = id
  drag.x0 = e.clientX
  drag.y0 = e.clientY
  drag.base = openSwipeId.value === id ? -SWIPE_W : 0
  drag.dx = drag.base
  drag.axis = ''
}

function onRowMove(e: PointerEvent) {
  if (!drag.id) return
  const mx = e.clientX - drag.x0
  const my = e.clientY - drag.y0
  if (!drag.axis) {
    if (Math.abs(mx) < 8 && Math.abs(my) < 8) return
    drag.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'
    if (drag.axis === 'x') (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  if (drag.axis === 'x') drag.dx = Math.min(0, Math.max(-SWIPE_W, drag.base + mx))
}

function onRowUp() {
  if (!drag.id) return
  if (drag.axis === 'x') {
    openSwipeId.value = drag.dx < -SWIPE_W / 2 ? drag.id : null
    justSwiped = true
    setTimeout(() => { justSwiped = false }, 0)
  }
  drag.id = ''
  drag.axis = ''
}

// Un clic tras deslizar, o con la fila abierta, no navega: solo cierra.
function onRowClickCapture(e: MouseEvent, id: string) {
  if (justSwiped) { e.preventDefault(); e.stopPropagation(); return }
  if (openSwipeId.value) {
    const onActions = (e.target as HTMLElement).closest('.um-actions')
    if (openSwipeId.value === id && onActions) return
    e.preventDefault()
    e.stopPropagation()
    openSwipeId.value = null
  }
}

watch(filteredRows, () => { openSwipeId.value = null })
</script>

<template>
  <!-- ── Page head ───────────────────────────────────────── -->
  <div class="u-page-head">
    <div>
      <div class="u-page-title">Usuarios de Discord</div>
      <div style="font-size:14.5px; color:var(--dim); margin-top:4px">Lista de miembros del Discord.</div>
    </div>
    <div class="u-count-pill">
      <UIcon name="i-lucide-users" class="w-[15px] h-[15px]" style="color:var(--dim)" />
      <b>{{ totalCount?.count?.toLocaleString() ?? '—' }}</b>
      <span>usuarios</span>
    </div>
  </div>

  <!-- ── Filter panel ────────────────────────────────────── -->
  <section class="stc-panel u-filters">

    <!-- Row 1: search + summary + clear -->
    <div class="u-frow">
      <div class="u-search">
        <UIcon name="i-lucide-search" class="u-s-ico" />
        <input
          v-model="q"
          type="text"
          placeholder="Buscar usuario…"
        />
        <button
          v-if="q"
          class="u-clr-q"
          title="Borrar búsqueda"
          @click.stop="q = ''; page = 1"
        >
          <UIcon name="i-lucide-x" class="w-3.5 h-3.5" />
        </button>
      </div>

      <div class="u-results">
        <span class="u-summary stc-mono">
          Mostrando <b>{{ filteredRows.length.toLocaleString() }}</b> de {{ (totalCount?.count ?? users?.length ?? 0).toLocaleString() }}
        </span>
        <button
          class="u-clear-all"
          :class="{ show: filtersActive }"
          @click="clearAll"
        >
          <UIcon name="i-lucide-rotate-ccw" class="w-3 h-3" />
          Limpiar filtros
        </button>
      </div>
    </div>

    <!-- Row 2: roles + sin reuniones + divider + estado -->
    <div class="u-frow u-divline">
      <div class="u-fgroup">
        <span class="stc-eyebrow" style="margin-right:2px">Rol</span>
        <button
          class="u-chip"
          :class="{ on: selectedRoles.includes('alpha'), alpha: selectedRoles.includes('alpha') }"
          @click="toggleRole('alpha')"
        >
          <UIcon name="i-lucide-check" class="u-tick" />
          Alpha
        </button>
        <button
          class="u-chip"
          :class="{ on: selectedRoles.includes('delta'), delta: selectedRoles.includes('delta') }"
          @click="toggleRole('delta')"
        >
          <UIcon name="i-lucide-check" class="u-tick" />
          Delta
        </button>
        <button
          class="u-chip"
          :class="{ on: selectedRoles.includes('ninguno'), neutral: selectedRoles.includes('ninguno') }"
          @click="toggleRole('ninguno')"
        >
          <UIcon name="i-lucide-check" class="u-tick" />
          Ninguno
        </button>
      </div>

      <button
        class="u-chip"
        :class="{ on: noMeetings, neutral: noMeetings }"
        @click="noMeetings = !noMeetings; page = 1"
      >
        <UIcon name="i-lucide-check" class="u-tick" />
        <UIcon name="i-lucide-calendar-off" class="w-3 h-3" />
        Sin reuniones
      </button>

      <div class="u-divider-v" />

      <div class="u-fgroup">
        <span class="stc-eyebrow" style="margin-right:2px">Estado</span>
        <div class="u-seg u-estado">
          <button
            :class="{ on: estado === 'todos' }"
            @click="setEstado('todos')"
          >Todos</button>
          <button
            :class="{ on: estado === 'activos' }"
            @click="setEstado('activos')"
          >Activos</button>
          <button
            data-estado="eliminados"
            :class="{ on: estado === 'eliminados', eliminados: estado === 'eliminados' }"
            @click="setEstado('eliminados')"
          >Eliminados</button>
        </div>
      </div>
    </div>

    <!-- Row 3: ubicación (país → provincia → ciudad) -->
    <div class="u-frow u-divline">
      <div class="u-fgroup u-loc">
        <span class="stc-eyebrow" style="margin-right:2px">Ubicación</span>
        <select
          class="u-select"
          :class="{ set: country }"
          :value="country"
          aria-label="País"
          @change="setCountry(($event.target as HTMLSelectElement).value)"
        >
          <option value="">Todos los países</option>
          <option v-for="c in locations?.countries" :key="c.code" :value="c.code">
            {{ countryLabel(c.code) }} ({{ c.count }})
          </option>
          <option v-if="locations?.noneCount" value="none">Sin ubicación ({{ locations.noneCount }})</option>
        </select>
        <select
          class="u-select"
          :class="{ set: region }"
          :value="region"
          :disabled="!selectedCountry"
          aria-label="Provincia o estado"
          @change="setRegion(($event.target as HTMLSelectElement).value)"
        >
          <option value="">Todas las provincias</option>
          <option v-for="r in regionOptions" :key="r.key" :value="r.key">
            {{ r.name ?? 'Sin provincia' }} ({{ r.count }})
          </option>
        </select>
        <select
          v-model="city"
          class="u-select"
          :class="{ set: city }"
          :disabled="!cityOptions.length"
          aria-label="Ciudad"
        >
          <option value="">Todas las ciudades</option>
          <option v-for="c in cityOptions" :key="c.key" :value="c.key">
            {{ c.name }} ({{ c.count }})
          </option>
        </select>
      </div>
    </div>

    <!-- Row 4: ordenar + direction + periodo -->
    <div class="u-frow u-divline">
      <div class="u-fgroup">
        <span class="stc-eyebrow" style="margin-right:2px">Ordenar</span>
        <div class="u-sortwrap">
          <div class="u-seg u-orden-seg">
            <button :class="{ on: orden === 'recent' }"      @click="setOrden('recent')">
              <UIcon name="i-lucide-clock" class="w-3 h-3" />
              Recientes
            </button>
            <button :class="{ on: orden === 'meetings' }"    @click="setOrden('meetings')">Reuniones</button>
            <button :class="{ on: orden === 'messages30d' }" @click="setOrden('messages30d')">Mensajes 30d</button>
            <button :class="{ on: orden === 'lifetime' }"    @click="setOrden('lifetime')">Mensajes total</button>
            <button :class="{ on: orden === 'joinedAt' }"    @click="setOrden('joinedAt')">Antigüedad</button>
          </div>
          <button
            class="u-sortdir stc-mono"
            :class="{ asc: dir === 'asc' }"
            :disabled="sortDirDisabled"
            @click="toggleDir"
          >
            <UIcon name="i-lucide-arrow-down" class="w-3.5 h-3.5 u-sort-arrow" />
            <span>{{ sortDirLabel }}</span>
          </button>
        </div>
      </div>

      <!-- Periodo popover -->
      <div class="u-pop-anchor" style="margin-left:auto" @click.stop>
        <button
          class="u-periodo-btn"
          :class="{ set: periodoCount > 0 }"
          @click="togglePopover"
        >
          <UIcon name="i-lucide-calendar-range" class="w-3.5 h-3.5" />
          Periodo
          <span v-if="periodoCount > 0" class="u-pcount stc-mono">{{ periodoCount }}</span>
          <UIcon name="i-lucide-chevron-down" class="w-3.5 h-3.5" />
        </button>
        <div class="u-popover" :class="{ open: popoverOpen }" @click.stop>
          <div class="u-pophead">
            <span class="stc-eyebrow">Rango de fechas</span>
            <button
              class="stc-mono"
              style="font-size:11px; color:var(--dim); background:none; border:none; cursor:pointer"
              @click="dateFrom = ''; dateTo = ''; page = 1"
            >
              Limpiar
            </button>
          </div>
          <div class="stc-dfield" style="margin-bottom:10px">
            <label>Desde</label>
            <input v-model="dateFrom" type="date" @change="page = 1" />
          </div>
          <div class="stc-dfield">
            <label>Hasta</label>
            <input v-model="dateTo" type="date" @change="page = 1" />
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── Table panel ─────────────────────────────────────── -->
  <section class="stc-panel u-table-panel">

    <!-- Header -->
    <div class="u-thead u-tgrid">
      <div class="stc-eyebrow">Usuario</div>
      <div class="stc-eyebrow">Roles</div>
      <div class="stc-eyebrow u-col-activity">Actividad</div>
      <div class="stc-eyebrow u-col-contact">Contactado por</div>
      <div class="stc-eyebrow">Última actividad</div>
      <div class="stc-eyebrow" style="text-align:right">Acciones</div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="pending">
      <div v-for="i in 8" :key="i" class="u-trow u-tgrid">
        <div class="flex items-center gap-3">
          <USkeleton class="w-2 h-2 rounded-full flex-shrink-0" />
          <USkeleton class="w-9 h-9 rounded-lg flex-shrink-0" />
          <div class="space-y-1.5">
            <USkeleton class="h-3.5 w-28" />
            <USkeleton class="h-3 w-20" />
          </div>
        </div>
        <div class="flex gap-1.5">
          <USkeleton class="h-5 w-14 rounded-md" />
          <USkeleton class="h-5 w-8 rounded-md" />
        </div>
        <div class="u-col-activity space-y-1">
          <USkeleton class="h-3.5 w-36" />
          <USkeleton class="h-3 w-24" />
        </div>
        <div class="u-col-contact">
          <USkeleton class="h-5 w-16 rounded-md" />
        </div>
        <div class="space-y-1.5">
          <USkeleton class="h-5 w-24 rounded-md" />
          <USkeleton class="h-3 w-32" />
        </div>
        <div class="flex justify-end gap-1.5">
          <USkeleton class="w-8 h-8 rounded-lg" />
          <USkeleton class="w-8 h-8 rounded-lg" />
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="!paginatedRows.length" class="u-empty">
      Ningún usuario coincide con los filtros.
    </div>

    <!-- Rows -->
    <template v-else>
      <div
        v-for="user in paginatedRows"
        :key="user._id"
        class="u-trow u-tgrid"
      >
        <!-- 1. Usuario -->
        <div class="u-ucell">
          <span class="u-pres" :class="{ green: isOnline(user) }" />
          <div
            class="u-av"
            :style="user.avatarUrl ? {} : { background: avatarGrad(user.username) }"
          >
            <img v-if="user.avatarUrl" :src="user.avatarUrl" :alt="user.username" />
            <template v-else>{{ user.username.replace(/[^A-Za-z0-9]/g,'').charAt(0).toUpperCase() || '?' }}</template>
          </div>
          <div class="u-uname">
            <div class="u-nm">{{ user.username }}</div>
            <div class="u-uid stc-mono">@{{ user.username.toLowerCase() }}</div>
          </div>
        </div>

        <!-- 2. Roles -->
        <div class="u-roles">
          <template v-if="displayRoles(user).labeled.length || displayRoles(user).extra">
            <span
              v-for="r in displayRoles(user).labeled"
              :key="r.label"
              class="u-rbadge"
              :class="r.type"
            >{{ r.label }}</span>
            <span v-if="displayRoles(user).extra" class="u-rbadge more">
              +{{ displayRoles(user).extra }}
            </span>
          </template>
          <span v-else class="u-rbadge none">Ninguno</span>
        </div>

        <!-- 3. Actividad -->
        <div class="u-act u-col-activity">
          <div class="u-a1 stc-mono">
            <b>{{ (user.meetingCount ?? 0).toLocaleString() }}</b> mtgs<span class="u-sep"> · </span><b>{{ (user.messages30d ?? 0).toLocaleString() }}</b> msgs/30d
          </div>
          <div class="u-a2 stc-mono">{{ (user.messageCount ?? 0).toLocaleString() }} msgs total</div>
        </div>

        <!-- 4. Contactado por -->
        <div class="u-col-contact">
          <template v-if="user.contactedBy?.length">
            <span
              v-for="name in user.contactedBy.slice(0,2)"
              :key="name"
              class="u-ctag stc-mono"
            >{{ name }}</span>
          </template>
          <span v-else class="u-cnone stc-mono">—</span>
        </div>

        <!-- 5. Última actividad -->
        <div class="u-lact">
          <span class="u-badge stc-mono" :class="activityBadge(user).cls">
            <span v-if="activityBadge(user).cls === 'badge-active'" class="u-pulse" />
            {{ activityBadge(user).text }}
          </span>
          <div class="u-since stc-mono">
            <UIcon name="i-lucide-cake" class="w-3 h-3" style="color:var(--faint)" />
            Miembro hace {{ memberSince(user) }}
          </div>
        </div>

        <!-- 6. Acciones -->
        <div class="u-ractions">
          <NuxtLink :to="`/discord-users/${user._id}`" class="u-rbtn" title="Ver perfil">
            <UIcon name="i-lucide-user" class="w-[15px] h-[15px]" />
          </NuxtLink>
          <NuxtLink :to="`/meetings?userId=${user._id}`" class="u-rbtn" title="Agendar reunión">
            <UIcon name="i-lucide-calendar" class="w-[15px] h-[15px]" />
          </NuxtLink>
          <a :href="`discord://-/users/${user._id}`" class="u-rbtn" title="Contactar en Discord">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width:15px;height:15px;flex-shrink:0">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.055 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.19.372-.287a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.097.246.193.373.287a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
          </a>
        </div>
      </div>
    </template>

    <!-- Pager -->
    <div v-if="!pending && filteredRows.length > PAGE_SIZE" class="u-pager">
      <button class="u-pbtn" :disabled="page === 1" @click="page = 1">
        <UIcon name="i-lucide-chevrons-left" class="w-[15px] h-[15px]" />
      </button>
      <button class="u-pbtn" :disabled="page === 1" @click="goPrev">
        <UIcon name="i-lucide-chevron-left" class="w-[15px] h-[15px]" />
      </button>
      <template v-for="p in visiblePages(page, totalPages)" :key="p">
        <span v-if="p === '...'" class="u-pbtn" style="border:none; cursor:default; color:var(--faint)">…</span>
        <button v-else class="u-pbtn" :class="{ on: p === page }" @click="page = (p as number)">
          {{ p }}
        </button>
      </template>
      <button class="u-pbtn" :disabled="page === totalPages" @click="goNext">
        <UIcon name="i-lucide-chevron-right" class="w-[15px] h-[15px]" />
      </button>
      <button class="u-pbtn" :disabled="page === totalPages" @click="page = totalPages">
        <UIcon name="i-lucide-chevrons-right" class="w-[15px] h-[15px]" />
      </button>
    </div>
  </section>

  <!-- ══ Móvil (<768px): búsqueda fija + lista compacta ══════════ -->
  <div class="um">
    <div class="um-head">
      <div class="um-search">
        <UIcon name="i-lucide-search" class="w-4 h-4 flex-shrink-0" />
        <input
          v-model="q"
          type="search"
          enterkeyhint="search"
          placeholder="Buscar usuario"
          aria-label="Buscar usuario"
        />
        <button v-if="q" type="button" aria-label="Borrar búsqueda" @click="q = ''">
          <UIcon name="i-lucide-x" class="w-4 h-4" />
        </button>
      </div>

      <div class="um-chips">
        <button type="button" class="um-chip" :class="{ on: sheetFilterCount }" @click="sheetOpen = true">
          <UIcon name="i-lucide-sliders-horizontal" class="w-3.5 h-3.5" />
          Filtros
          <span v-if="sheetFilterCount" class="um-count">{{ sheetFilterCount }}</span>
        </button>
        <button type="button" class="um-chip" :class="{ on: selectedRoles.includes('alpha') }" @click="toggleRole('alpha')">Alpha</button>
        <button type="button" class="um-chip" :class="{ on: selectedRoles.includes('delta') }" @click="toggleRole('delta')">Delta</button>
        <button type="button" class="um-chip" :class="{ on: noMeetings }" @click="noMeetings = !noMeetings">Sin reuniones</button>
        <button type="button" class="um-chip" :class="{ on: orden !== 'recent' }" @click="sheetOpen = true">
          {{ ORDEN_LABELS[orden] }}
          <UIcon name="i-lucide-chevron-down" class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <div class="um-meta">
      <span class="stc-mono">
        <b>{{ filteredRows.length.toLocaleString() }}</b>
        de {{ (totalCount?.count ?? users?.length ?? 0).toLocaleString() }} usuarios
      </span>
      <button v-if="filtersActive" type="button" class="um-clear" @click="clearAll">
        <UIcon name="i-lucide-rotate-ccw" class="w-3 h-3" />
        Limpiar
      </button>
    </div>

    <div class="um-list stc-panel">
      <template v-if="pending && !users?.length">
        <div v-for="i in 8" :key="i" class="um-row um-skel">
          <USkeleton class="w-10 h-10 rounded-[10px] flex-shrink-0" />
          <div class="flex-1 space-y-1.5">
            <USkeleton class="h-3.5 w-32 rounded" />
            <USkeleton class="h-3 w-24 rounded" />
          </div>
          <USkeleton class="h-3 w-8 rounded" />
        </div>
      </template>

      <div v-else-if="!filteredRows.length" class="um-empty">
        <UIcon name="i-lucide-search-x" class="w-7 h-7" />
        <p>Ningún usuario coincide con los filtros.</p>
        <button v-if="filtersActive" type="button" class="um-chip on" @click="clearAll">Limpiar filtros</button>
      </div>

      <template v-else>
        <div
          v-for="user in mobileRows"
          :key="user._id"
          class="um-swipe"
          :class="{ open: openSwipeId === user._id }"
        >
          <div class="um-actions" :aria-hidden="openSwipeId !== user._id">
            <NuxtLink :to="`/meetings?userId=${user._id}`" class="um-act sched" :tabindex="openSwipeId === user._id ? 0 : -1">
              <UIcon name="i-lucide-calendar" class="w-5 h-5" />
              Agendar
            </NuxtLink>
            <a :href="`discord://-/users/${user._id}`" class="um-act discord" :tabindex="openSwipeId === user._id ? 0 : -1">
              <svg viewBox="0 0 24 24" fill="currentColor" style="width:20px;height:20px" aria-hidden="true">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.055 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.19.372-.287a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.097.246.193.373.287a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Discord
            </a>
          </div>

          <NuxtLink
            :to="`/discord-users/${user._id}`"
            class="um-row"
            :class="{ dragging: drag.id === user._id && drag.axis === 'x' }"
            :style="{ transform: `translateX(${rowOffset(user._id)}px)` }"
            draggable="false"
            @pointerdown="onRowDown($event, user._id)"
            @pointermove="onRowMove"
            @pointerup="onRowUp"
            @pointercancel="onRowUp"
            @click.capture="onRowClickCapture($event, user._id)"
          >
            <div
              class="um-av"
              :style="user.avatarUrl ? {} : { background: avatarGrad(user.username) }"
            >
              <img v-if="user.avatarUrl" :src="user.avatarUrl" :alt="''" loading="lazy" draggable="false" />
              <template v-else>{{ user.username.replace(/[^A-Za-z0-9]/g,'').charAt(0).toUpperCase() || '?' }}</template>
              <span v-if="isOnline(user)" class="um-online" />
            </div>

            <div class="um-body">
              <div class="um-name">
                <span class="truncate">{{ user.username }}</span>
                <span v-for="t in roleTypes(user)" :key="t" class="um-role" :class="t">{{ t === 'alpha' ? 'Alpha' : 'Delta' }}</span>
              </div>
              <div class="um-sub stc-mono">
                {{ (user.meetingCount ?? 0).toLocaleString() }} mtgs · {{ (user.messages30d ?? 0).toLocaleString() }} msgs/30d
              </div>
            </div>

            <span class="um-ago stc-mono" :class="'t-' + activityBadge(user).cls">{{ shortAgo(user) }}</span>
          </NuxtLink>
        </div>

        <div v-if="hasMoreMobile" :key="mobileLimit" ref="sentinel" class="um-more">
          <button type="button" class="um-chip" @click="loadMoreMobile">Cargar más</button>
        </div>
        <div v-else-if="filteredRows.length > MOBILE_STEP" class="um-end">Fin de la lista</div>
      </template>
    </div>

    <!-- Hoja de filtros -->
    <ClientOnly>
    <Teleport to="body">
      <Transition name="um-fade">
        <div v-if="sheetOpen" class="um-backdrop" @click="sheetOpen = false" />
      </Transition>
      <Transition name="um-sheet">
        <div v-if="sheetOpen" class="um-sheet" role="dialog" aria-label="Filtros">
          <div class="um-grip" />
          <div class="um-sheet-head">
            <span>Filtros</span>
            <button type="button" class="um-link" @click="clearAll">Limpiar</button>
          </div>

          <div class="um-sheet-body">
            <div class="um-sec">
              <div class="stc-eyebrow">Rol</div>
              <div class="um-wrap">
                <button type="button" class="um-chip" :class="{ on: selectedRoles.includes('alpha') }" @click="toggleRole('alpha')">Alpha</button>
                <button type="button" class="um-chip" :class="{ on: selectedRoles.includes('delta') }" @click="toggleRole('delta')">Delta</button>
                <button type="button" class="um-chip" :class="{ on: selectedRoles.includes('ninguno') }" @click="toggleRole('ninguno')">Ninguno</button>
                <button type="button" class="um-chip" :class="{ on: noMeetings }" @click="noMeetings = !noMeetings">Sin reuniones</button>
              </div>
            </div>

            <div class="um-sec">
              <div class="stc-eyebrow">Estado</div>
              <div class="stc-seg um-seg">
                <button :class="{ on: estado === 'todos' }" @click="setEstado('todos')">Todos</button>
                <button :class="{ on: estado === 'activos' }" @click="setEstado('activos')">Activos</button>
                <button :class="{ on: estado === 'eliminados' }" @click="setEstado('eliminados')">Eliminados</button>
              </div>
            </div>

            <div class="um-sec">
              <div class="stc-eyebrow">Ubicación</div>
              <select class="um-select" :value="country" aria-label="País" @change="setCountry(($event.target as HTMLSelectElement).value)">
                <option value="">Todos los países</option>
                <option v-for="c in locations?.countries" :key="c.code" :value="c.code">{{ countryLabel(c.code) }} ({{ c.count }})</option>
                <option v-if="locations?.noneCount" value="none">Sin ubicación ({{ locations.noneCount }})</option>
              </select>
              <select v-if="selectedCountry" class="um-select" :value="region" aria-label="Provincia o estado" @change="setRegion(($event.target as HTMLSelectElement).value)">
                <option value="">Todas las provincias</option>
                <option v-for="r in regionOptions" :key="r.key" :value="r.key">{{ r.name ?? 'Sin provincia' }} ({{ r.count }})</option>
              </select>
              <select v-if="cityOptions.length" v-model="city" class="um-select" aria-label="Ciudad">
                <option value="">Todas las ciudades</option>
                <option v-for="c in cityOptions" :key="c.key" :value="c.key">{{ c.name }} ({{ c.count }})</option>
              </select>
            </div>

            <div class="um-sec">
              <div class="flex items-center justify-between">
                <div class="stc-eyebrow">Ordenar</div>
                <button
                  v-if="!sortDirDisabled"
                  type="button"
                  class="um-link"
                  @click="toggleDir"
                >
                  <UIcon :name="dir === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'" class="w-3.5 h-3.5" />
                  {{ sortDirLabel }}
                </button>
              </div>
              <div class="um-wrap">
                <button
                  v-for="(label, key) in ORDEN_LABELS"
                  :key="key"
                  type="button"
                  class="um-chip"
                  :class="{ on: orden === key }"
                  @click="setOrden(key)"
                >{{ label }}</button>
              </div>
            </div>

            <div class="um-sec">
              <div class="stc-eyebrow">Periodo de reuniones</div>
              <div class="um-dates">
                <div class="stc-dfield"><label>Desde</label><input v-model="dateFrom" type="date" /></div>
                <div class="stc-dfield"><label>Hasta</label><input v-model="dateTo" type="date" /></div>
              </div>
            </div>
          </div>

          <div class="um-sheet-foot">
            <button type="button" class="um-apply" @click="sheetOpen = false">
              <template v-if="pending">Buscando…</template>
              <template v-else>Ver {{ filteredRows.length.toLocaleString() }} usuarios</template>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
    </ClientOnly>
  </div>
</template>

<style scoped>
/* ── Page head ──────────────────────────────────────────── */
.u-page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}
.u-page-title {
  font-family: var(--disp);
  font-size: 34px;
  font-weight: 800;
  letter-spacing: .004em;
  line-height: 1.04;
  text-transform: uppercase;
  color: var(--text);
}
.u-count-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--mono);
  font-size: 13px;
  color: var(--text);
  padding: 8px 14px;
  border-radius: var(--r-sm);
  border: 1px solid var(--line);
  background: var(--panel);
}
.u-count-pill b { color: var(--amber-2); font-weight: 600; }

/* ── Filter panel ───────────────────────────────────────── */
.u-filters { padding: 15px 18px; display: flex; flex-direction: column; gap: 13px; }
.u-frow    { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.u-divline { padding-top: 13px; border-top: 1px solid var(--line); }

/* ubicación */
.u-loc { flex-wrap: wrap; }
.u-select {
  font-family: var(--ui);
  font-size: 12.5px;
  color: var(--text);
  background: var(--inset);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  padding: 6px 9px;
  max-width: 230px;
  outline: none;
  cursor: pointer;
  color-scheme: dark;
  transition: .14s;
}
html:not(.dark) .u-select { color-scheme: light; }
.u-select:focus { border-color: var(--gold-ring); }
.u-select.set { border-color: var(--gold-ring); background: var(--gold-wash); }
.u-select:disabled { opacity: .45; cursor: not-allowed; }
.u-fgroup  { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.u-divider-v { width: 1px; align-self: stretch; background: var(--line); margin: 0 4px; min-height: 24px; }

/* search */
.u-search { position: relative; flex: 1; min-width: 240px; max-width: 420px; }
.u-s-ico {
  position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
  width: 16px; height: 16px; color: var(--faint); pointer-events: none;
}
.u-search input {
  width: 100%; font-family: var(--ui); font-size: 13.5px;
  color: var(--text); background: var(--inset); border: 1px solid var(--line);
  border-radius: var(--r-sm); padding: 10px 34px 10px 36px; outline: none; transition: .15s;
}
.u-search input::placeholder { color: var(--faint); }
.u-search input:focus {
  border-color: var(--gold-ring);
  background: var(--inset);
  box-shadow: 0 0 0 3px var(--gold-wash);
}
.u-clr-q {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  width: 22px; height: 22px; border: none; background: transparent;
  color: var(--faint); border-radius: 5px; cursor: pointer;
  display: grid; place-items: center; transition: .14s;
}
.u-clr-q:hover { color: var(--text); background: rgba(255,255,255,.06); }

/* results + clear */
.u-results  { display: flex; align-items: center; gap: 12px; margin-left: auto; }
.u-summary  { font-size: 12px; color: var(--dim); white-space: nowrap; }
.u-summary b { color: var(--text); font-weight: 600; }
.u-clear-all {
  display: inline-flex; align-items: center; gap: 5px;
  font-family: var(--ui); font-size: 12px; font-weight: 500;
  color: var(--amber-2); background: transparent; border: none;
  cursor: pointer; padding: 5px 8px; border-radius: 6px; transition: .14s;
  visibility: hidden;
}
.u-clear-all.show { visibility: visible; }
.u-clear-all:hover { background: var(--amber-dim); }

/* multi-select pill chips */
.u-chip {
  font-family: var(--ui); font-size: 12.5px; font-weight: 500;
  color: var(--dim); padding: 6px 12px; border-radius: 999px;
  border: 1px solid var(--line); background: transparent;
  cursor: pointer; transition: .14s; white-space: nowrap;
  display: inline-flex; align-items: center; gap: 6px;
}
.u-chip:hover { color: var(--text); border-color: var(--line-2); background: rgba(255,255,255,.03); }
html:not(.dark) .u-chip:hover { background: rgba(0,0,0,.03); }
.u-tick { width: 13px; height: 13px; margin: 0 -2px 0 -3px; opacity: 0; transform: scale(.6); transition: .14s; }
.u-chip.on .u-tick { opacity: 1; transform: scale(1); }
.u-chip.on.alpha   { color: var(--amber-2); background: var(--amber-dim); border-color: var(--gold-ring); }
.u-chip.on.delta   { color: var(--blue);    background: var(--blue-dim);  border-color: var(--blue-line); }
.u-chip.on.neutral { color: var(--text);    background: rgba(255,255,255,.07); border-color: var(--line-2); }

/* single-select segmented (boxed, no overflow:hidden) */
.u-seg {
  display: flex;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  flex-shrink: 0;
}
.u-seg button:first-child { border-top-left-radius: 7px; border-bottom-left-radius: 7px; }
.u-seg button:last-child  { border-top-right-radius: 7px; border-bottom-right-radius: 7px; }
.u-seg button {
  font-family: var(--ui); font-size: 12.5px; font-weight: 500;
  color: var(--dim); padding: 7px 13px; background: transparent;
  border: none; border-right: 1px solid var(--line); cursor: pointer;
  transition: .14s; white-space: nowrap;
  display: inline-flex; align-items: center; gap: 6px;
}
.u-seg button:last-child { border-right: none; }
.u-seg button:hover { color: var(--text); background: rgba(255,255,255,.03); }
html:not(.dark) .u-seg button:hover { background: rgba(0,0,0,.03); }
.u-seg button.on { color: var(--gold-ink); font-weight: 600; background: var(--amber); }
.u-estado button.on.eliminados { background: var(--red); color: var(--red-ink); }

/* sort dir */
.u-sortwrap { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.u-sortdir {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11.5px; color: var(--dim);
  padding: 7px 11px; border-radius: var(--r-sm);
  border: 1px solid var(--line); background: transparent;
  cursor: pointer; transition: .14s;
}
.u-sortdir:hover:not(:disabled) {
  color: var(--text); border-color: var(--line-2); background: rgba(255,255,255,.03);
}
html:not(.dark) .u-sortdir:hover:not(:disabled) { background: rgba(0,0,0,.03); }
.u-sort-arrow { transition: transform .18s; }
.u-sortdir.asc .u-sort-arrow { transform: rotate(180deg); }
.u-sortdir:disabled { opacity: .4; cursor: default; }

/* periodo */
.u-pop-anchor  { position: relative; }
.u-periodo-btn {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--ui); font-size: 12.5px; font-weight: 500;
  color: var(--dim); padding: 7px 13px; border-radius: var(--r-sm);
  border: 1px solid var(--line); background: transparent;
  cursor: pointer; transition: .14s;
}
.u-periodo-btn:hover { color: var(--text); border-color: var(--line-2); background: rgba(255,255,255,.03); }
html:not(.dark) .u-periodo-btn:hover { background: rgba(0,0,0,.03); }
.u-periodo-btn.set { color: var(--amber-2); border-color: var(--gold-ring); background: var(--amber-dim); }
.u-pcount {
  font-size: 10px; min-width: 16px; height: 16px; padding: 0 4px;
  border-radius: 8px; background: var(--amber); color: var(--gold-ink);
  display: grid; place-items: center;
}
.u-popover {
  position: absolute; top: calc(100% + 8px); right: 0; z-index: 40;
  width: 264px; padding: 14px;
  border-radius: var(--r); background: var(--panel-2);
  border: 1px solid var(--line-2);
  box-shadow: 0 16px 40px rgba(0,0,0,.55);
  display: none;
}
.u-popover.open  { display: block; }
.u-pophead {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 11px;
}

/* ── Table ──────────────────────────────────────────────── */
.u-tgrid {
  display: grid;
  grid-template-columns: minmax(220px,2fr) minmax(140px,1.1fr) minmax(180px,1.4fr) minmax(120px,1fr) minmax(170px,1.2fr) 96px;
  align-items: center;
  gap: 14px;
}
.u-thead { padding: 16px 24px; border-bottom: 1px solid var(--line); }
.u-trow  {
  padding: 15px 24px;
  border-bottom: 1px solid var(--line);
  transition: background .14s;
}
.u-trow:last-child { border-bottom: none; }
.u-trow:hover { background: rgba(255,255,255,.022); }
html:not(.dark) .u-trow:hover { background: rgba(0,0,0,.02); }

/* user cell */
.u-ucell  { display: flex; align-items: center; gap: 13px; min-width: 0; }
.u-pres   { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: var(--line-2); }
.u-pres.green { background: var(--green); position: relative; }
.u-pres.green::after {
  content: ''; position: absolute; inset: -3px; border-radius: 50%;
  border: 1.5px solid var(--green); opacity: .5;
}
.u-av {
  width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0;
  display: grid; place-items: center;
  font-family: var(--disp); font-weight: 800; font-size: 17px; color: var(--text);
  border: 1px solid var(--line-2); overflow: hidden;
}
.u-av img { width: 100%; height: 100%; object-fit: cover; }
.u-uname   { min-width: 0; }
.u-nm      { font-size: 14.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text); }
.u-uid     { font-size: 11px; color: var(--faint); margin-top: 2px; }

/* roles */
.u-roles   { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.u-rbadge  { font-family: var(--mono); font-size: 11px; font-weight: 500; padding: 3px 9px; border-radius: 6px; white-space: nowrap; }
.u-rbadge.alpha  { color: var(--amber-2); background: var(--amber-dim); border: 1px solid var(--gold-ring); }
.u-rbadge.delta  { color: var(--blue);    background: var(--blue-dim);  border: 1px solid var(--blue-line); }
.u-rbadge.more   { color: var(--dim);     background: rgba(255,255,255,.05); border: 1px solid var(--line); }
.u-rbadge.none   { color: var(--faint);   background: transparent; border: 1px dashed var(--line-2); }

/* activity */
.u-act { min-width: 0; }
.u-a1  { font-size: 13px; color: var(--dim); white-space: nowrap; }
.u-a1 b { color: var(--text); font-weight: 600; }
.u-sep { color: var(--faint); margin: 0 5px; }
.u-a2  { font-size: 11.5px; color: var(--faint); margin-top: 3px; }

/* contacted */
.u-ctag  {
  font-size: 11px; font-weight: 500; color: var(--amber-2);
  padding: 3px 9px; border-radius: 6px;
  background: var(--amber-dim); border: 1px solid var(--gold-ring);
  display: inline-block;
}
.u-cnone { color: var(--faint); font-size: 13px; }

/* last activity */
.u-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 500; padding: 3px 9px; border-radius: 6px;
}
.badge-active   { color: var(--green); background: var(--green-dim); border: 1px solid var(--green-line); }
.badge-slipping { color: var(--amber-2); background: var(--amber-dim); border: 1px solid var(--gold-ring); }
.badge-inactive { color: var(--red); background: var(--red-dim); border: 1px solid var(--red-line); }
.badge-dormant  { color: var(--faint); background: rgba(255,255,255,.04); border: 1px solid var(--line); }
.u-pulse { width: 6px; height: 6px; border-radius: 50%; background: var(--green); flex-shrink: 0; }
.u-since {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: var(--dim); margin-top: 6px;
}
.u-lact { }

/* row actions */
.u-ractions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
.u-rbtn {
  display: grid; place-items: center;
  width: 32px; height: 32px; border-radius: 7px;
  color: var(--dim); border: 1px solid var(--line); background: transparent;
  transition: .14s; text-decoration: none;
}
.u-rbtn:hover { color: var(--amber-2); border-color: var(--gold-ring); background: var(--amber-dim); }

/* empty */
.u-empty { padding: 60px 24px; text-align: center; color: var(--faint); font-family: var(--mono); font-size: 13px; }

/* pagination */
.u-pager {
  display: flex; align-items: center; justify-content: center;
  gap: 7px; padding: 20px 24px; border-top: 1px solid var(--line);
}
.u-pbtn {
  min-width: 34px; height: 34px; padding: 0 10px;
  display: grid; place-items: center;
  border-radius: 7px; font-family: var(--mono); font-size: 12.5px;
  color: var(--dim); border: 1px solid var(--line); background: transparent;
  cursor: pointer; transition: .14s;
}
.u-pbtn:hover:not(:disabled):not(.on) {
  color: var(--text); border-color: var(--line-2); background: rgba(255,255,255,.03);
}
html:not(.dark) .u-pbtn:hover:not(:disabled):not(.on) { background: rgba(0,0,0,.03); }
.u-pbtn.on { color: var(--gold-ink); font-weight: 600; background: var(--amber); border-color: var(--amber); }
.u-pbtn:disabled { opacity: .35; cursor: not-allowed; }

/* responsive — hide activity + contact at ≤1200px */
@media (max-width: 1200px) {
  .u-tgrid {
    grid-template-columns: minmax(200px,2fr) minmax(130px,1fr) minmax(160px,1.2fr) 96px;
  }
  .u-col-activity, .u-col-contact { display: none; }
}

/* ══ Móvil: lista compacta (.um-*) ═════════════════════════ */
.um { display: none; }

@media (max-width: 767px) {
  /* La tabla y el panel de filtros de escritorio no se usan en móvil. */
  .u-page-head, .u-filters, .u-table-panel { display: none !important; }
  .um { display: block; }
}

/* Búsqueda + chips: fija arriba del área de scroll */
.um-head {
  position: sticky;
  top: 0;
  z-index: 10;
  margin: -20px -16px 0;
  padding: 12px 16px 10px;
  background: var(--bg);
  border-bottom: 1px solid var(--line);
}
.um-search {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 42px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid var(--line-2);
  background: var(--panel);
  color: var(--faint);
}
.um-search:focus-within { border-color: var(--gold-ring); }
.um-search input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--text);
  font-family: var(--ui);
  font-size: 16px; /* ≥16px evita el zoom automático de iOS */
}
.um-search input::placeholder { color: var(--faint); }
.um-search input::-webkit-search-cancel-button { display: none; }
.um-search button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--dim);
}

.um-chips {
  display: flex;
  gap: 7px;
  margin: 10px -16px 0;
  padding: 0 16px;
  overflow-x: auto;
  scrollbar-width: none;
}
.um-chips::-webkit-scrollbar { display: none; }

.um-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--line-2);
  background: transparent;
  color: var(--dim);
  font-family: var(--ui);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.um-chip.on {
  color: var(--gold-soft);
  border-color: var(--gold-ring);
  background: var(--gold-wash);
}
.um-count {
  display: grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--gold);
  color: var(--gold-ink);
  font-size: 11px;
  font-weight: 700;
}

.um-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 2px 8px;
  font-size: 12.5px;
  color: var(--faint);
}
.um-meta b { color: var(--text); font-weight: 600; }
.um-clear, .um-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 0;
  background: transparent;
  color: var(--gold-soft);
  font-family: var(--ui);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}

/* Lista */
.um-list { overflow: hidden; }
.um-swipe {
  position: relative;
  overflow: hidden;
  border-top: 1px solid var(--line);
}
.um-swipe:first-child { border-top: 0; }

.um-row {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  padding: 10px 14px;
  background: var(--panel);
  color: inherit;
  text-decoration: none;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: transform .22s cubic-bezier(.2,.8,.2,1), background .15s;
}
.um-row.dragging { transition: none; }
.um-row:active { background: var(--panel-2); }
.um-skel { pointer-events: none; border-top: 1px solid var(--line); }
.um-skel:first-child { border-top: 0; }

.um-av {
  position: relative;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-family: var(--disp);
  font-weight: 800;
  font-size: 18px;
  color: #f0f0f0;
}
.um-av img {
  width: 100%;
  height: 100%;
  border-radius: 10px;
  object-fit: cover;
  pointer-events: none;
}
.um-online {
  position: absolute;
  right: -3px;
  bottom: -3px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--green);
  border: 2.5px solid var(--panel);
}

.um-body { flex: 1; min-width: 0; }
.um-name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.25;
}
.um-role {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 5px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: .02em;
}
.um-role.alpha { color: var(--gold-soft); background: var(--gold-wash); }
.um-role.delta { color: var(--blue); background: var(--blue-dim); }
.um-sub {
  margin-top: 3px;
  font-size: 12.5px;
  color: var(--faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.um-ago {
  flex-shrink: 0;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--faint);
}
.um-ago.t-badge-active   { color: var(--green); }
.um-ago.t-badge-slipping { color: var(--gold-soft); }
.um-ago.t-badge-inactive { color: var(--red); }

/* Acciones detrás de la fila */
.um-actions {
  position: absolute;
  inset: 0 0 0 auto;
  display: flex;
  width: 136px;
}
.um-act {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 600;
  text-decoration: none;
}
.um-act.sched   { background: var(--gold); color: var(--gold-ink); }
.um-act.discord { background: #5865f2; color: #fff; }

.um-more, .um-end, .um-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px;
  border-top: 1px solid var(--line);
  font-size: 12.5px;
  color: var(--faint);
}
.um-empty { border-top: 0; padding: 40px 20px; text-align: center; }
.um-empty .iconify { opacity: .5; }

/* Hoja de filtros (teletransportada a body: sin scope de página) */
.um-backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: rgba(0,0,0,.6);
}
.um-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 75;
  display: flex;
  flex-direction: column;
  max-height: 88vh;
  max-height: 88dvh;
  background: var(--panel);
  border-top: 1px solid var(--line-2);
  border-radius: 20px 20px 0 0;
}
.um-grip {
  width: 38px;
  height: 4px;
  margin: 10px auto 4px;
  border-radius: 4px;
  background: var(--line-2);
}
.um-sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 18px 10px;
  font-family: var(--disp);
  font-size: 22px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text);
}
.um-sheet-body {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 18px 8px;
}
.um-sec {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 12px 0;
  border-top: 1px solid var(--line);
}
.um-sec:first-child { border-top: 0; }
.um-wrap { display: flex; flex-wrap: wrap; gap: 7px; }
.um-seg button { flex: 1; padding: 9px 6px; font-size: 13px; }
.um-select {
  width: 100%;
  height: 42px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--line-2);
  background: var(--inset);
  color: var(--text);
  font-family: var(--ui);
  font-size: 16px;
  color-scheme: dark;
}
html:not(.dark) .um-select { color-scheme: light; }
.um-dates { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.um-dates .stc-dfield { min-width: 0; }
.um-dates input { width: 100%; min-width: 0; font-size: 16px; padding: 8px 9px; }
.um-sheet-foot {
  padding: 12px 18px calc(14px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--line);
}
.um-apply {
  width: 100%;
  height: 48px;
  border: 0;
  border-radius: 12px;
  background: var(--gold);
  color: var(--gold-ink);
  font-family: var(--ui);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.um-fade-enter-active, .um-fade-leave-active { transition: opacity .2s; }
.um-fade-enter-from, .um-fade-leave-to { opacity: 0; }
.um-sheet-enter-active, .um-sheet-leave-active { transition: transform .26s cubic-bezier(.2,.8,.2,1); }
.um-sheet-enter-from, .um-sheet-leave-to { transform: translateY(100%); }
</style>
