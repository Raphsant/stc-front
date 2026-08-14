<script setup lang="ts">
const route = useRoute()
const userId = route.params.id
const toast = useToast()
const { loggedIn, session } = useUserSession()

const { data: user, pending, error } = useFetch(`/api/discord-users/${userId}`)
const { data: activity, pending: activityPending } = useFetch(`/api/discord-users/${userId}/activity`)
const { data: watched, pending: watchedPending } = useFetch(`/api/discord-users/${userId}/watched`)
const {
  data: journal,
  pending: journalPending,
  refresh: refreshJournal,
} = useFetch<JournalEntry[]>(`/api/discord-users/${userId}/journal`, { default: () => [] })

interface PainPoint {
  category: string
  detail: string
  severity: 'baja' | 'media' | 'alta'
}

interface AnalysisResult {
  summary: string
  sentiment: 'positivo' | 'neutral' | 'negativo'
  painPoints: PainPoint[]
}

interface JournalEntry {
  _id: string
  discordUserId: string
  type: 'text' | 'image'
  content: string
  imageUrl?: string | null
  adminId: string
  adminUsername: string
  createdAt: string
  updatedAt: string
  markedForDeletion: boolean
  markedForDeletionAt?: string | null
  markedForDeletionBy?: string | null
  analysisStatus?: 'none' | 'pending' | 'done' | 'error'
  analysisResult?: AnalysisResult | null
  analyzedAt?: string | null
  analysisError?: string | null
}

const CATEGORY_LABELS: Record<string, string> = {
  precio: 'Precio / valor',
  tiempo: 'Falta de tiempo',
  contenido: 'Contenido',
  soporte: 'Soporte / atención',
  comunidad: 'Comunidad',
  plataforma: 'Plataforma / técnico',
  expectativas: 'Expectativas',
  resultados: 'Resultados / progreso',
  competencia: 'Competencia',
  personal: 'Circunstancias personales',
  otro: 'Otro',
}

function categoryLabel(cat: string) {
  return CATEGORY_LABELS[cat] ?? cat
}

// Tonos de la marca para las insignias
function severityTone(sev: string) {
  return sev === 'alta' ? 'red' : sev === 'media' ? 'gold' : 'neutral'
}

const ENGAGEMENT_TONE: Record<string, string> = {
  success: 'green',
  warning: 'gold',
  error: 'red',
  neutral: 'neutral',
}

const journalType = ref<'text' | 'image'>('text')
const journalText = ref('')
const journalSubmitting = ref(false)
const journalFile = ref<File | null>(null)
const journalFileInput = ref<HTMLInputElement | null>(null)

const ALLOWED_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const journalTypeItems = [
  { value: 'text', label: 'Texto', icon: 'i-lucide-file-text' },
  { value: 'image', label: 'Imagen', icon: 'i-lucide-image' },
]

function onFilePick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  if (!file) {
    journalFile.value = null
    return
  }
  if (!ALLOWED_IMAGE_MIME.includes(file.type)) {
    toast.add({ title: 'Formato no soportado. Usa PNG, JPG, WebP o GIF.', color: 'warning' })
    input.value = ''
    return
  }
  if (file.size > MAX_IMAGE_BYTES) {
    toast.add({ title: 'La imagen supera el tamaño máximo de 5MB.', color: 'warning' })
    input.value = ''
    return
  }
  journalFile.value = file
}

function clearJournalFile() {
  journalFile.value = null
  if (journalFileInput.value) journalFileInput.value.value = ''
}

async function submitJournalEntry() {
  if (journalSubmitting.value) return
  journalSubmitting.value = true
  try {
    if (journalType.value === 'text') {
      const content = journalText.value.trim()
      if (!content) {
        toast.add({ title: 'Escribe algo antes de guardar.', color: 'warning' })
        return
      }
      await $fetch(`/api/discord-users/${userId}/journal`, {
        method: 'POST',
        body: { type: 'text', content },
      })
      journalText.value = ''
    } else {
      const file = journalFile.value
      if (!file) {
        toast.add({ title: 'Selecciona una imagen primero.', color: 'warning' })
        return
      }
      const { uploadUrl, key } = await $fetch<{ uploadUrl: string, key: string }>(
        `/api/discord-users/${userId}/journal-upload-url`,
        {
          method: 'POST',
          body: { contentType: file.type, size: file.size },
        },
      )
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!putRes.ok) {
        throw new Error(`Upload failed (${putRes.status})`)
      }
      await $fetch(`/api/discord-users/${userId}/journal`, {
        method: 'POST',
        body: { type: 'image', content: key },
      })
      clearJournalFile()
    }
    await refreshJournal()
    toast.add({ title: 'Entrada añadida a la bitácora.', color: 'success' })
  } catch (e: any) {
    toast.add({
      title: 'No se pudo añadir la entrada.',
      description: e?.statusMessage || e?.message || '',
      color: 'error',
    })
  } finally {
    journalSubmitting.value = false
  }
}

const journalActionId = ref<string | null>(null)

async function toggleMarkForDeletion(entry: JournalEntry) {
  journalActionId.value = entry._id
  try {
    await $fetch(`/api/discord-users/${userId}/journal/${entry._id}`, { method: 'PATCH' })
    await refreshJournal()
    toast.add({
      title: entry.markedForDeletion ? 'Marca eliminada' : 'Entrada marcada para eliminar',
      color: entry.markedForDeletion ? 'neutral' : 'warning',
    })
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.statusMessage || e?.message || '', color: 'error' })
  } finally {
    journalActionId.value = null
  }
}

async function approveDelete(entry: JournalEntry) {
  journalActionId.value = entry._id
  try {
    await $fetch(`/api/discord-users/${userId}/journal/${entry._id}`, { method: 'DELETE' })
    await refreshJournal()
    toast.add({ title: 'Entrada eliminada', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.statusMessage || e?.message || '', color: 'error' })
  } finally {
    journalActionId.value = null
  }
}

const analyzingId = ref<string | null>(null)

async function analyzeEntry(entry: JournalEntry) {
  analyzingId.value = entry._id
  try {
    await $fetch(`/api/discord-users/${userId}/journal/${entry._id}/analyze`, { method: 'POST' })
    await refreshJournal()
    toast.add({ title: 'Imagen analizada', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Error al analizar', description: e?.statusMessage || e?.message || '', color: 'error' })
  } finally {
    analyzingId.value = null
  }
}

// Per-user rollup: pain points grouped by category across this user's analyzed
// screenshots, ordered by frequency.
const painPointRollup = computed(() => {
  const map = new Map<string, { category: string; count: number; details: PainPoint[] }>()
  for (const entry of journal.value ?? []) {
    if (entry.analysisStatus !== 'done' || !entry.analysisResult) continue
    for (const pp of entry.analysisResult.painPoints ?? []) {
      const existing = map.get(pp.category) ?? { category: pp.category, count: 0, details: [] }
      existing.count++
      existing.details.push(pp)
      map.set(pp.category, existing)
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
})

useSeoMeta({
  title: computed(() => user.value ? `${user.value.username} - STC Control` : 'Usuario - STC Control'),
  description: computed(() => user.value ? `Perfil de ${user.value.username} en el Stock Trading Club.` : 'Perfil de usuario.'),
  ogTitle: computed(() => user.value ? `${user.value.username} - STC Control` : 'Usuario - STC Control'),
})

const roleClass: Record<string, string> = {
  'Alpha.': 'gold',
  'Alpha': 'gold',
  'Delta': 'blue',
  'Delta.': 'blue',
}

const engagement = computed(() => {
  const lastMsg = activity.value?.lastMessageAt ?? null
  const lastMtg = user.value?.lastMeetingAt ?? null
  return getEngagementState(lastMsg, lastMtg)
})

const lastActive = computed(() => {
  const msg = activity.value?.lastMessageAt ? new Date(activity.value.lastMessageAt).getTime() : 0
  const mtg = user.value?.lastMeetingAt ? new Date(user.value.lastMeetingAt).getTime() : 0
  const max = Math.max(msg, mtg)
  return max ? new Date(max) : null
})

const messagesDelta = computed(() => {
  if (!activity.value) return null
  const { last30, prev30 } = activity.value.totals
  if (!prev30) return last30 > 0 ? { pct: 100, up: true } : null
  const pct = Math.round(((last30 - prev30) / prev30) * 100)
  return { pct: Math.abs(pct), up: pct >= 0 }
})

interface HeatmapCell {
  date: string | null
  count: number
  isMeetingDay: boolean
  tooltip: string
}

const meetingDays = computed(() => {
  const set = new Set<string>()
  if (user.value?.lastMeetingAt) {
    // We only have the last meeting date from this endpoint, so mark just that.
    const d = new Date(user.value.lastMeetingAt)
    const key = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
      .toISOString().slice(0, 10)
    set.add(key)
  }
  return set
})

const heatmap = computed<HeatmapCell[][]>(() => {
  const days = activity.value?.daily ?? []
  const dayMap = new Map<string, number>()
  for (const d of days) dayMap.set(d.date, d.count)

  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const todayDow = today.getUTCDay()

  // Align so last column ends on today's day-of-week (rows 0..todayDow filled, rest empty)
  const totalCells = 13 * 7
  const startOffset = totalCells - 1 - todayDow
  const startDate = new Date(today.getTime() - startOffset * 86400000)

  const columns: HeatmapCell[][] = []
  for (let col = 0; col < 13; col++) {
    const column: HeatmapCell[] = []
    for (let row = 0; row < 7; row++) {
      const idx = col * 7 + row
      const cellDate = new Date(startDate.getTime() + idx * 86400000)
      if (cellDate > today) {
        column.push({ date: null, count: 0, isMeetingDay: false, tooltip: '' })
        continue
      }
      const key = cellDate.toISOString().slice(0, 10)
      const count = dayMap.get(key) ?? 0
      const isMeetingDay = meetingDays.value.has(key)
      const label = cellDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
      const tooltip = `${label} — ${count} ${count === 1 ? 'mensaje' : 'mensajes'}${isMeetingDay ? ' · reunión' : ''}`
      column.push({ date: key, count, isMeetingDay, tooltip })
    }
    columns.push(column)
  }
  return columns
})

const heatmapMax = computed(() => {
  const days = activity.value?.daily ?? []
  return Math.max(1, ...days.map(d => d.count))
})

function cellClass(cell: HeatmapCell): string {
  if (!cell.date) return 'hm-void'
  if (cell.count === 0) return 'hm-0'
  const pct = cell.count / heatmapMax.value
  if (pct < 0.25) return 'hm-1'
  if (pct < 0.5) return 'hm-2'
  if (pct < 0.75) return 'hm-3'
  return 'hm-4'
}

const topChannels = computed(() => {
  const all = activity.value?.byChannel ?? []
  return all.slice(0, 5)
})

const topChannelMax = computed(() => {
  return Math.max(1, ...topChannels.value.map((c: any) => c.count))
})

function formatVideoTitle(key: string): string {
  if (!key) return 'Vídeo sin título'
  const last = key.split('/').pop() || key
  return last.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_]+/g, ' ').trim() || key
}

function videoProgressPct(v: { timestamp: number, duration: number }): number {
  if (!v.duration || v.duration <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((v.timestamp / v.duration) * 100)))
}

function initial(name?: string) {
  return (name || '?').replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase() || '?'
}
</script>

<template>
  <div class="up-page">
    <NuxtLink to="/discord-users" class="stc-link-all" style="align-self:flex-start">
      <UIcon name="i-lucide-arrow-left" class="w-3.5 h-3.5" />
      Volver al directorio
    </NuxtLink>

    <!-- Carga -->
    <template v-if="pending">
      <USkeleton class="h-40 w-full rounded-[10px]" />
      <USkeleton class="h-64 w-full rounded-[10px]" />
    </template>

    <!-- Error -->
    <section v-else-if="error" class="stc-panel up-alert">
      <UIcon name="i-lucide-circle-alert" class="w-6 h-6" />
      <div>
        <div class="up-alert-t">Usuario no encontrado</div>
        <p class="up-alert-p">{{ error.message }}</p>
        <NuxtLink to="/discord-users" class="stc-btn sm" style="margin-top:14px">Volver a la lista</NuxtLink>
      </div>
    </section>

    <template v-else-if="user">
      <!-- ── Cabecera de perfil ────────────────────────────── -->
      <section class="stc-panel up-hero">
        <div class="up-av">
          <img v-if="user.avatarUrl" :src="user.avatarUrl" :alt="user.username">
          <template v-else>{{ initial(user.username) }}</template>
        </div>

        <div class="up-hero-body">
          <div class="up-idline">
            <h1 class="up-name">{{ user.username }}</h1>
            <span class="stc-badge" :class="ENGAGEMENT_TONE[engagement.color]">
              <span v-if="engagement.state === 'active'" class="stc-dot green" />
              {{ engagement.label }}
            </span>
            <span v-if="user.removedAt" class="stc-badge red">
              <UIcon name="i-lucide-log-out" class="w-3 h-3" />
              Eliminado
            </span>
          </div>

          <div class="up-subline stc-mono">
            <span class="stc-code up-id">{{ user._id }}</span>
            <template v-if="user.joinedAt">
              <span class="up-sep">·</span>
              <span :title="new Date(user.joinedAt).toLocaleString('es-ES')">
                <UIcon name="i-lucide-user-plus" class="w-3.5 h-3.5" />
                Miembro {{ formatRelativeTime(user.joinedAt) }}
              </span>
            </template>
            <template v-if="user.removedAt">
              <span class="up-sep">·</span>
              <span :title="new Date(user.removedAt).toLocaleString('es-ES')">
                <UIcon name="i-lucide-log-out" class="w-3.5 h-3.5" />
                Eliminado {{ formatRelativeTime(user.removedAt) }}
              </span>
            </template>
          </div>

          <div v-if="user.roles?.length" class="up-roles">
            <span
              v-for="role in user.roles"
              :key="role"
              class="stc-badge"
              :class="roleClass[role] || 'neutral'"
            >{{ role }}</span>
          </div>

          <div style="margin-top:16px">
            <a :href="`discord://-/users/${user._id}`" class="stc-btn sm">
              <svg viewBox="0 0 24 24" fill="currentColor" style="width:15px;height:15px;flex-shrink:0">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.055 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.19.372-.287a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.097.246.193.373.287a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Contactar en Discord
            </a>
          </div>
        </div>
      </section>

      <!-- ── Actividad ─────────────────────────────────────── -->
      <section class="stc-panel">
        <div class="stc-panel-head">
          <h2 class="stc-panel-title">
            <UIcon name="i-lucide-activity" class="w-[18px] h-[18px]" />
            Actividad
          </h2>
        </div>

        <div class="up-pad">
          <!-- Tres métricas -->
          <div class="up-stats">
            <div class="up-stat gold">
              <span class="stc-eyebrow">Reuniones</span>
              <span class="up-stat-n">{{ user.meetingCount }}</span>
              <span class="up-stat-note stc-mono">
                <template v-if="user.lastMeetingAt">
                  Última: {{ new Date(user.lastMeetingAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) }}
                </template>
                <template v-else>Sin reuniones</template>
              </span>
            </div>

            <div class="up-stat">
              <span class="stc-eyebrow">Mensajes · 30d</span>
              <USkeleton v-if="activityPending" class="h-9 w-16" style="margin:4px 0" />
              <span v-else class="up-stat-n">{{ activity?.totals?.last30 ?? 0 }}</span>
              <span v-if="!activityPending && messagesDelta" class="up-stat-note">
                <span class="stc-delta" :class="messagesDelta.up ? 'up' : 'down'">
                  <UIcon
                    :name="messagesDelta.up ? 'i-lucide-arrow-up-right' : 'i-lucide-arrow-down-right'"
                    class="w-3 h-3"
                  />
                  {{ messagesDelta.pct }}%
                </span>
                <span class="stc-delta-note">vs. 30d previos</span>
              </span>
              <span v-else-if="!activityPending" class="up-stat-note stc-mono">Sin datos previos</span>
            </div>

            <div class="up-stat">
              <span class="stc-eyebrow">Última actividad</span>
              <span
                class="up-stat-n sm"
                :class="{ muted: !lastActive }"
                :title="lastActive ? new Date(lastActive).toLocaleString('es-ES') : ''"
              >
                {{ lastActive ? formatRelativeTime(lastActive) : 'nunca' }}
              </span>
              <span class="up-stat-note stc-mono">mensajes y reuniones</span>
            </div>
          </div>

          <!-- Mapa de calor -->
          <div class="up-block">
            <div class="up-block-head">
              <h3 class="up-block-t">Actividad 90 días</h3>
              <div class="up-legend">
                <span>Menos</span>
                <i class="hm-cell hm-0" />
                <i class="hm-cell hm-1" />
                <i class="hm-cell hm-2" />
                <i class="hm-cell hm-3" />
                <i class="hm-cell hm-4" />
                <span>Más</span>
              </div>
            </div>
            <USkeleton v-if="activityPending" class="h-24 w-full" />
            <div v-else class="up-heatmap">
              <div v-for="(col, ci) in heatmap" :key="ci" class="up-hcol">
                <span
                  v-for="(cell, ri) in col"
                  :key="`${ci}-${ri}`"
                  class="hm-cell"
                  :class="[cellClass(cell), { meeting: cell.isMeetingDay }]"
                  :title="cell.tooltip || ''"
                />
              </div>
            </div>
            <p class="up-foot-note">
              Seguimiento desde el inicio del sistema — los días vacíos anteriores no son ceros reales.
            </p>
          </div>

          <!-- Canales -->
          <div v-if="!activityPending && topChannels.length > 1" class="up-block">
            <h3 class="up-block-t" style="margin-bottom:12px">Canales más activos (30d)</h3>
            <div class="up-chans">
              <div v-for="c in topChannels" :key="c.channelId" class="up-chan">
                <div class="up-chan-row">
                  <span class="up-chan-name">#{{ c.channelName || c.channelId }}</span>
                  <span class="up-chan-n stc-mono">{{ c.count }}</span>
                </div>
                <div class="stc-meter" style="margin-top:6px">
                  <i :style="{ width: `${(c.count / topChannelMax) * 100}%` }" />
                </div>
              </div>
            </div>
          </div>

          <NuxtLink :to="`/meetings?userId=${user._id}`" class="stc-btn gold block" style="margin-top:22px">
            <UIcon name="i-lucide-calendar-days" class="w-4 h-4" />
            Ver historial completo
          </NuxtLink>
        </div>
      </section>

      <!-- ── Vídeos vistos ─────────────────────────────────── -->
      <section class="stc-panel">
        <div class="stc-panel-head">
          <h2 class="stc-panel-title">
            <UIcon name="i-lucide-circle-play" class="w-[18px] h-[18px]" />
            Vídeos vistos
          </h2>
          <span v-if="!watchedPending" class="stc-badge neutral stc-mono">
            {{ watched?.total ?? 0 }} {{ watched?.total === 1 ? 'vídeo' : 'vídeos' }}
          </span>
        </div>

        <div v-if="watchedPending" class="up-pad up-stack">
          <USkeleton v-for="n in 3" :key="n" class="h-14 w-full rounded-[7px]" />
        </div>
        <div v-else-if="!watched?.recent?.length" class="stc-empty">
          <UIcon name="i-lucide-film" />
          <p>Aún no ha visto ningún vídeo.</p>
        </div>
        <ul v-else class="up-pad up-stack">
          <li v-for="video in watched.recent" :key="video._id" class="up-vid">
            <span class="up-vid-glyph">
              <UIcon name="i-lucide-film" class="w-4 h-4" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="up-vid-t">{{ formatVideoTitle(video.videoKey) }}</div>
              <div class="up-vid-prog">
                <div class="stc-meter">
                  <i :style="{ width: `${videoProgressPct(video)}%` }" />
                </div>
                <span class="up-vid-pct stc-mono">{{ videoProgressPct(video) }}%</span>
              </div>
            </div>
            <span class="up-vid-time stc-mono" :title="new Date(video.updatedAt).toLocaleString('es-ES')">
              {{ formatRelativeTime(video.updatedAt) }}
            </span>
          </li>
        </ul>
      </section>

      <!-- ── Bitácora ──────────────────────────────────────── -->
      <section class="stc-panel">
        <div class="stc-panel-head">
          <h2 class="stc-panel-title">
            <UIcon name="i-lucide-book-open" class="w-[18px] h-[18px]" />
            Bitácora
          </h2>
          <span v-if="!journalPending" class="stc-badge neutral stc-mono">
            {{ journal?.length ?? 0 }} {{ journal?.length === 1 ? 'entrada' : 'entradas' }}
          </span>
        </div>

        <div class="up-pad">
          <!-- Formulario -->
          <div v-if="loggedIn" class="up-form">
            <div class="stc-seg" style="width:fit-content; margin-bottom:12px">
              <button
                v-for="item in journalTypeItems"
                :key="item.value"
                :class="{ on: journalType === item.value }"
                @click="journalType = item.value as 'text' | 'image'"
              >
                <UIcon :name="item.icon" class="w-3.5 h-3.5" style="display:inline-block; vertical-align:-2px; margin-right:5px" />
                {{ item.label }}
              </button>
            </div>

            <!-- Texto -->
            <template v-if="journalType === 'text'">
              <textarea
                v-model="journalText"
                class="stc-input up-textarea"
                rows="4"
                placeholder="Escribe una nota sobre este usuario…"
              />
              <div class="up-form-foot">
                <p class="up-form-note">
                  Se registrará como <b>{{ session?.user?.username }}</b>
                </p>
                <button
                  class="stc-btn gold sm"
                  :disabled="journalSubmitting || !journalText.trim()"
                  @click="submitJournalEntry"
                >
                  <UIcon name="i-lucide-plus" class="w-3.5 h-3.5" />
                  {{ journalSubmitting ? 'Guardando…' : 'Añadir entrada' }}
                </button>
              </div>
            </template>

            <!-- Imagen -->
            <template v-else>
              <input
                ref="journalFileInput"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                class="hidden"
                @change="onFilePick"
              >
              <div v-if="!journalFile" class="up-drop" @click="journalFileInput?.click()">
                <UIcon name="i-lucide-cloud-upload" class="w-7 h-7" />
                <p class="up-drop-t">Haz clic para seleccionar una imagen</p>
                <p class="up-drop-p">PNG, JPG, WebP o GIF · máx. 5MB</p>
              </div>
              <div v-else class="up-file">
                <span class="up-file-glyph">
                  <UIcon name="i-lucide-image" class="w-4 h-4" />
                </span>
                <div class="min-w-0 flex-1">
                  <div class="up-file-n">{{ journalFile.name }}</div>
                  <div class="up-file-s stc-mono">{{ (journalFile.size / 1024).toFixed(1) }} KB</div>
                </div>
                <button class="stc-icon-btn" :disabled="journalSubmitting" @click="clearJournalFile">
                  <UIcon name="i-lucide-x" class="w-4 h-4" />
                </button>
              </div>
              <div class="up-form-foot">
                <p class="up-form-note">
                  Se registrará como <b>{{ session?.user?.username }}</b>
                </p>
                <button
                  class="stc-btn gold sm"
                  :disabled="journalSubmitting || !journalFile"
                  @click="submitJournalEntry"
                >
                  <UIcon name="i-lucide-upload" class="w-3.5 h-3.5" />
                  {{ journalSubmitting ? 'Subiendo…' : 'Subir imagen' }}
                </button>
              </div>
            </template>
          </div>
          <div v-else class="up-locked">
            Inicia sesión como administrador para añadir entradas.
          </div>

          <!-- Resumen de puntos de dolor -->
          <div v-if="painPointRollup.length" class="up-rollup">
            <div class="up-rollup-head">
              <span class="up-rollup-t">
                <UIcon name="i-lucide-sparkles" class="w-4 h-4" />
                Puntos de dolor del cliente
              </span>
              <NuxtLink to="/journal/pain-points" class="up-rollup-link">Ver panel global →</NuxtLink>
            </div>
            <div class="up-stack" style="gap:8px">
              <div v-for="row in painPointRollup" :key="row.category" class="up-rollup-row">
                <span class="stc-badge gold">{{ categoryLabel(row.category) }} · {{ row.count }}</span>
                <span class="up-rollup-d">{{ row.details.map(d => d.detail).join(' · ') }}</span>
              </div>
            </div>
          </div>

          <!-- Línea de tiempo -->
          <div v-if="journalPending" class="up-stack" style="margin-top:20px">
            <USkeleton v-for="n in 3" :key="n" class="h-16 w-full rounded-[7px]" />
          </div>
          <div v-else-if="!journal?.length" class="stc-empty" style="padding:36px 24px">
            <UIcon name="i-lucide-book-open" />
            <p>Aún no hay entradas en la bitácora.</p>
          </div>
          <ol v-else class="up-timeline">
            <li v-for="entry in journal" :key="entry._id" class="up-tl-item">
              <span class="up-tl-node" />
              <div class="up-entry" :class="{ flagged: entry.markedForDeletion }">
                <div class="up-entry-head">
                  <span class="up-entry-who">
                    <UIcon
                      :name="entry.type === 'image' ? 'i-lucide-image' : 'i-lucide-file-text'"
                      class="w-3.5 h-3.5"
                      style="color:var(--gold)"
                    />
                    <b>{{ entry.adminUsername }}</b>
                  </span>
                  <span class="up-entry-time stc-mono" :title="new Date(entry.createdAt).toLocaleString('es-ES')">
                    {{ formatRelativeTime(entry.createdAt) }}
                  </span>
                </div>

                <p v-if="entry.type === 'text'" class="up-entry-text">{{ entry.content }}</p>
                <a v-else-if="entry.imageUrl" :href="entry.imageUrl" target="_blank" rel="noopener" class="up-entry-img">
                  <img :src="entry.imageUrl" :alt="entry.content" loading="lazy">
                </a>
                <div v-else class="up-entry-na">Imagen no disponible</div>

                <!-- Marca de eliminación -->
                <div v-if="entry.markedForDeletion" class="up-flag">
                  <UIcon name="i-lucide-flag" class="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Marcado para eliminar por <b>{{ entry.markedForDeletionBy }}</b></span>
                </div>

                <!-- Análisis IA -->
                <div
                  v-if="entry.type === 'image' && entry.analysisStatus === 'done' && entry.analysisResult"
                  class="up-ai"
                >
                  <span class="up-ai-t">
                    <UIcon name="i-lucide-sparkles" class="w-3.5 h-3.5" />
                    Análisis IA
                  </span>
                  <p class="up-ai-p">{{ entry.analysisResult.summary }}</p>
                  <div v-if="entry.analysisResult.painPoints.length" class="up-ai-pps">
                    <span
                      v-for="(pp, i) in entry.analysisResult.painPoints"
                      :key="i"
                      class="stc-badge"
                      :class="severityTone(pp.severity)"
                    >{{ categoryLabel(pp.category) }}: {{ pp.detail }}</span>
                  </div>
                  <p v-else class="up-ai-none">No se detectaron puntos de dolor.</p>
                </div>
                <div
                  v-else-if="entry.type === 'image' && entry.analysisStatus === 'error'"
                  class="up-ai-err"
                >
                  <UIcon name="i-lucide-triangle-alert" class="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Error al analizar{{ entry.analysisError ? `: ${entry.analysisError}` : '' }}</span>
                </div>

                <!-- Acciones -->
                <div v-if="loggedIn" class="up-entry-actions">
                  <button
                    v-if="entry.type === 'image'"
                    class="stc-btn sm gold-soft"
                    :disabled="analyzingId === entry._id"
                    @click="analyzeEntry(entry)"
                  >
                    <UIcon name="i-lucide-sparkles" class="w-3.5 h-3.5" />
                    {{ analyzingId === entry._id ? 'Analizando…' : (entry.analysisStatus === 'done' ? 'Reanalizar' : 'Analizar') }}
                  </button>
                  <button
                    v-if="(session?.user as any)?.role === 'superadmin' && entry.markedForDeletion"
                    class="stc-btn sm danger"
                    :disabled="journalActionId === entry._id"
                    @click="approveDelete(entry)"
                  >
                    <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" />
                    Aprobar eliminación
                  </button>
                  <button
                    class="stc-btn sm"
                    :disabled="journalActionId === entry._id"
                    @click="toggleMarkForDeletion(entry)"
                  >
                    <UIcon :name="entry.markedForDeletion ? 'i-lucide-undo-2' : 'i-lucide-flag'" class="w-3.5 h-3.5" />
                    {{ entry.markedForDeletion ? 'Desmarcar' : 'Marcar para eliminar' }}
                  </button>
                </div>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <!-- ── Información técnica ───────────────────────────── -->
      <section class="stc-panel">
        <div class="stc-panel-head">
          <h2 class="stc-panel-title">
            <UIcon name="i-lucide-fingerprint" class="w-[18px] h-[18px]" />
            Información técnica
          </h2>
        </div>
        <div class="up-pad up-stack" style="gap:18px">
          <div v-if="user.previousUsernames?.length">
            <span class="stc-eyebrow">Nombres anteriores</span>
            <div class="up-prevs">
              <span v-for="prev in user.previousUsernames" :key="prev" class="stc-badge outline">{{ prev }}</span>
            </div>
          </div>
          <div>
            <span class="stc-eyebrow">Roles asignados ({{ user.roles?.length || 0 }})</span>
            <p class="up-tech-p">{{ user.roles?.join(', ') || 'Sin roles asignados' }}</p>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.up-page  { display: flex; flex-direction: column; gap: 16px; max-width: 1000px; width: 100%; }
.up-pad   { padding: 20px 22px 22px; }
.up-stack { display: flex; flex-direction: column; gap: 10px; }
.hidden   { display: none; }

/* alerta */
.up-alert {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 22px;
  color: var(--red);
  border-color: var(--red-line);
  background: var(--red-dim);
}
.up-alert-t {
  font-family: var(--disp);
  font-size: 24px;
  font-weight: 700;
  letter-spacing: .015em;
  text-transform: uppercase;
}
.up-alert-p { font-size: 13px; color: var(--dim); margin-top: 4px; }

/* ── Cabecera de perfil ── */
.up-hero { display: flex; gap: 22px; padding: 24px; flex-wrap: wrap; }
.up-av {
  width: 88px; height: 88px;
  border-radius: 16px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  font-family: var(--disp);
  font-weight: 800;
  font-size: 40px;
  color: var(--gold);
  background: var(--gold-wash);
  border: 1px solid var(--gold-ring);
}
.up-av img { width: 100%; height: 100%; object-fit: cover; }
.up-hero-body { flex: 1; min-width: 240px; }

.up-idline { display: flex; align-items: center; gap: 11px; flex-wrap: wrap; }
.up-name {
  font-family: var(--disp);
  font-size: 42px;
  font-weight: 800;
  letter-spacing: .004em;
  line-height: 1;
  text-transform: uppercase;
  color: var(--text);
}

.up-subline {
  display: flex;
  align-items: center;
  gap: 9px;
  flex-wrap: wrap;
  margin-top: 10px;
  font-size: 12px;
  color: var(--faint);
}
.up-subline span { display: inline-flex; align-items: center; gap: 5px; }
.up-id { color: var(--dim); background: var(--inset); border: 1px solid var(--line); border-radius: 5px; padding: 2px 7px; }
.up-sep { color: var(--line-2); }

.up-roles { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 14px; }

/* ── Métricas ── */
.up-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.up-stat {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 15px 17px;
  border-radius: var(--r);
  background: var(--inset);
  border: 1px solid var(--line);
}
.up-stat.gold { background: var(--gold-wash); border-color: var(--gold-ring); }
.up-stat-n {
  font-family: var(--disp);
  font-variant-numeric: tabular-nums;
  font-size: 40px;
  font-weight: 800;
  line-height: .92;
  color: var(--text);
}
.up-stat.gold .up-stat-n { color: var(--gold); }
.up-stat-n.sm { font-size: 24px; line-height: 1.1; }
.up-stat-n.muted { color: var(--faint); }
.up-stat-note {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11.5px;
  color: var(--faint);
}

/* ── Bloques ── */
.up-block { margin-top: 26px; }
.up-block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.up-block-t {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
.up-foot-note { font-size: 11px; color: var(--faint); margin-top: 10px; }

/* ── Mapa de calor ── */
.up-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  color: var(--faint);
}
.up-heatmap { display: flex; gap: 3px; overflow-x: auto; padding-bottom: 2px; }
.up-hcol    { display: flex; flex-direction: column; gap: 3px; }

.hm-cell {
  width: 13px; height: 13px;
  border-radius: 3px;
  display: block;
  flex-shrink: 0;
}
.hm-void { background: transparent; }
.hm-0 { background: #141414; }
.hm-1 { background: rgba(234,157,19,.25); }
.hm-2 { background: rgba(234,157,19,.45); }
.hm-3 { background: rgba(234,157,19,.7); }
.hm-4 { background: var(--gold); }
html:not(.dark) .hm-0 { background: #e6e2d8; }
.hm-cell.meeting { box-shadow: inset 0 0 0 1.5px var(--gold-soft); }

/* ── Canales ── */
.up-chans { display: flex; flex-direction: column; gap: 12px; }
.up-chan-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}
.up-chan-name { color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.up-chan-n    { color: var(--gold-soft); font-weight: 600; }

/* ── Vídeos ── */
.up-vid {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 11px 13px;
  border-radius: var(--r-sm);
  background: var(--inset);
  border: 1px solid var(--line);
}
.up-vid-glyph {
  width: 32px; height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  color: var(--gold);
  background: var(--gold-wash);
  border: 1px solid var(--gold-ring);
}
.up-vid-t {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.up-vid-prog { display: flex; align-items: center; gap: 10px; margin-top: 7px; }
.up-vid-prog .stc-meter { flex: 1; }
.up-vid-pct  { font-size: 11px; color: var(--faint); flex-shrink: 0; }
.up-vid-time { font-size: 11px; color: var(--faint); flex-shrink: 0; text-align: right; }

/* ── Formulario bitácora ── */
.up-form { margin-bottom: 22px; }
.up-textarea { resize: vertical; min-height: 92px; line-height: 1.55; font-family: var(--ui); }
.up-form-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 12px;
}
.up-form-note { font-size: 11.5px; color: var(--faint); }
.up-form-note b { color: var(--dim); font-weight: 600; }

.up-drop {
  padding: 28px 20px;
  border-radius: var(--r);
  border: 1px dashed var(--line-2);
  background: var(--inset);
  text-align: center;
  cursor: pointer;
  color: var(--faint);
  transition: .15s;
}
.up-drop:hover { border-color: var(--gold-ring); background: var(--gold-wash); color: var(--gold-soft); }
.up-drop-t { font-size: 13px; color: var(--dim); margin-top: 8px; }
.up-drop-p { font-size: 11px; color: var(--faint); margin-top: 3px; }

.up-file {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 13px;
  border-radius: var(--r-sm);
  background: var(--inset);
  border: 1px solid var(--line);
}
.up-file-glyph {
  width: 32px; height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  color: var(--gold);
  background: var(--gold-wash);
  border: 1px solid var(--gold-ring);
}
.up-file-n { font-size: 13px; font-weight: 500; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.up-file-s { font-size: 11px; color: var(--faint); margin-top: 2px; }

.up-locked {
  padding: 16px 18px;
  margin-bottom: 22px;
  border-radius: var(--r-sm);
  background: var(--inset);
  border: 1px solid var(--line);
  font-size: 13px;
  color: var(--faint);
}

/* ── Resumen puntos de dolor ── */
.up-rollup {
  padding: 15px 17px;
  margin-bottom: 22px;
  border-radius: var(--r);
  background: var(--gold-wash);
  border: 1px solid var(--gold-ring);
}
.up-rollup-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.up-rollup-t {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
  color: var(--gold-soft);
}
.up-rollup-link { font-size: 11.5px; font-weight: 600; color: var(--gold-soft); text-decoration: none; }
.up-rollup-link:hover { text-decoration: underline; }
.up-rollup-row { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.up-rollup-d { font-size: 11.5px; color: var(--dim); }

/* ── Línea de tiempo ── */
.up-timeline {
  position: relative;
  margin-top: 20px;
  padding-left: 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.up-timeline::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 12px;
  bottom: 12px;
  width: 1px;
  background: linear-gradient(180deg, var(--gold-line), var(--line) 75%);
}
.up-tl-item { position: relative; }
.up-tl-node {
  position: absolute;
  left: -21px;
  top: 16px;
  width: 11px; height: 11px;
  border-radius: 50%;
  background: var(--gold);
  box-shadow: 0 0 0 3px var(--panel);
}

.up-entry {
  padding: 14px 16px;
  border-radius: var(--r);
  background: var(--inset);
  border: 1px solid var(--line);
}
.up-entry.flagged { border-color: var(--gold-line); }

.up-entry-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 9px;
}
.up-entry-who { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; color: var(--dim); }
.up-entry-who b { color: var(--text); font-weight: 600; }
.up-entry-time { font-size: 11px; color: var(--faint); }

.up-entry-text {
  font-size: 13.5px;
  color: var(--dim);
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.up-entry-img { display: block; }
.up-entry-img img {
  max-height: 320px;
  width: auto;
  max-width: 100%;
  border-radius: var(--r-sm);
  border: 1px solid var(--line);
}
.up-entry-na { font-size: 11.5px; font-style: italic; color: var(--faint); }

.up-flag {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 12px;
  font-size: 11.5px;
  color: var(--gold-soft);
}
.up-flag b { font-weight: 600; }

/* ── Análisis IA ── */
.up-ai {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: var(--r-sm);
  background: var(--gold-wash);
  border: 1px solid var(--gold-ring);
}
.up-ai-t {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--gold-soft);
}
.up-ai-p    { font-size: 13px; color: var(--dim); line-height: 1.55; margin-top: 8px; }
.up-ai-pps  { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.up-ai-none { font-size: 11.5px; font-style: italic; color: var(--faint); margin-top: 8px; }
.up-ai-err {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 12px;
  font-size: 11.5px;
  color: var(--red);
}

.up-entry-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 14px;
}

/* ── Info técnica ── */
.up-prevs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
.up-tech-p { font-size: 13px; color: var(--dim); margin-top: 8px; line-height: 1.6; }

@media (max-width: 640px) {
  .up-hero { padding: 18px 16px; gap: 16px; }
  .up-av   { width: 68px; height: 68px; font-size: 32px; border-radius: 13px; }
  .up-name { font-size: 32px; }
  .up-pad  { padding: 16px; }
  .up-vid  { flex-wrap: wrap; }
  .up-vid-time { width: 100%; text-align: left; }
}
</style>
