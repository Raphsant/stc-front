<script setup lang="ts">
const route = useRoute()
const userId = route.params.id
const toast = useToast()
const { loggedIn, session } = useUserSession()

const { data: user, pending, error } = useFetch(`/api/discord-users/${userId}`)
const { data: activity, pending: activityPending } = useFetch(`/api/discord-users/${userId}/activity`)
const { data: watched, pending: watchedPending } = useFetch(`/api/discord-users/${userId}/watched`)
// ClickFunnels call is slow-ish and optional — don't block the page on it.
const { data: contact, status: contactStatus, error: contactError } = useFetch<any>(
  `/api/discord-users/${userId}/contact`, { lazy: true, server: false },
)
// Con server: false la petición queda 'idle' en el SSR y pasa a 'pending' al
// hidratar; tratar ambos como carga evita que el servidor pinte "no vinculado".
const contactPending = computed(() => contactStatus.value === 'idle' || contactStatus.value === 'pending')

function formatAddress(a: any): string[] {
  if (!a) return []
  const cityLine = [a.city, a.region, a.postalCode].filter(Boolean).join(', ')
  return [a.streetOne, a.streetTwo, cityLine, a.country].filter(Boolean)
}
const {
  data: journal,
  pending: journalPending,
  refresh: refreshJournal,
} = useFetch<JournalEntry[]>(`/api/discord-users/${userId}/journal`, { default: () => [] })

import {
  ACTION_TYPE_LABELS_ES,
  ALPHA_SIGNAL_LABELS_ES,
  ALPHA_SIGNAL_TONE,
  CATEGORY_LABELS_ES,
  DELTA_SCHEMA_VERSION,
  PRIORITY_LABELS_ES,
  PRIORITY_TONE,
  actionTypeLabel,
  categoryLabel,
  type AlphaFitSignal,
  type BestFitCategory,
  type DeltaAnalysisResult,
  type Priority,
} from '#shared/deltaAnalysis'
import { MAX_JOURNAL_IMAGES } from '#shared/journal'

interface JournalEntry {
  _id: string
  discordUserId: string
  type: 'text' | 'image'
  content: string
  imageUrl?: string | null
  /** One signed URL per screenshot, in conversation order (null = unavailable). */
  imageUrls?: (string | null)[]
  adminId: string
  adminUsername: string
  createdAt: string
  updatedAt: string
  markedForDeletion: boolean
  markedForDeletionAt?: string | null
  markedForDeletionBy?: string | null
  analysisStatus?: 'none' | 'pending' | 'done' | 'error'
  analysisResult?: DeltaAnalysisResult | null
  analyzedAt?: string | null
  analysisError?: string | null
  followUpStatus?: 'pending' | 'done' | null
  followUpPriority?: Priority | null
  recontactDate?: string | null
  followUpDoneAt?: string | null
  followUpDoneBy?: string | null
}

/** Signed URLs of an image entry's screenshots, in conversation order. */
function entryImageUrls(entry: JournalEntry): (string | null)[] {
  if (entry.imageUrls?.length) return entry.imageUrls
  return entry.imageUrl ? [entry.imageUrl] : []
}

/** Entries analyzed before the Delta rewrite carry the old pain-point shape. */
function isDeltaResult(entry: JournalEntry): boolean {
  return entry.analysisResult?.schema_version === DELTA_SCHEMA_VERSION
}

function formatDay(date?: string | null) {
  if (!date) return null
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

async function copyMessage(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ title: 'Mensaje copiado', color: 'success' })
  } catch {
    toast.add({ title: 'No se pudo copiar el mensaje', color: 'error' })
  }
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
// Screenshots picked for one image entry, in conversation order. They are
// uploaded together and analyzed as a single thread.
interface PickedImage { id: number, file: File, previewUrl: string }
const journalFiles = ref<PickedImage[]>([])
const journalFileInput = ref<HTMLInputElement | null>(null)
const journalDragging = ref(false)
let pickedImageSeq = 0

const ALLOWED_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const journalTypeItems = [
  { value: 'text', label: 'Texto', icon: 'i-lucide-file-text' },
  { value: 'image', label: 'Imagen', icon: 'i-lucide-image' },
]

function addJournalFiles(files: File[]) {
  let badType = 0
  let tooBig = 0
  let overLimit = 0
  for (const file of files) {
    if (!ALLOWED_IMAGE_MIME.includes(file.type)) { badType++; continue }
    if (file.size > MAX_IMAGE_BYTES) { tooBig++; continue }
    if (journalFiles.value.length >= MAX_JOURNAL_IMAGES) { overLimit++; continue }
    journalFiles.value.push({ id: ++pickedImageSeq, file, previewUrl: URL.createObjectURL(file) })
  }
  if (badType) toast.add({ title: 'Formato no soportado. Usa PNG, JPG, WebP o GIF.', color: 'warning' })
  if (tooBig) toast.add({ title: 'Cada imagen puede pesar como máximo 5MB.', color: 'warning' })
  if (overLimit) toast.add({ title: `Máximo ${MAX_JOURNAL_IMAGES} imágenes por entrada.`, color: 'warning' })
}

function onFilePick(e: Event) {
  const input = e.target as HTMLInputElement
  addJournalFiles([...(input.files ?? [])])
  // Reset so picking the same file again still fires `change`.
  input.value = ''
}

function onFileDrop(e: DragEvent) {
  journalDragging.value = false
  if (journalSubmitting.value) return
  addJournalFiles([...(e.dataTransfer?.files ?? [])])
}

function removeJournalFile(id: number) {
  const i = journalFiles.value.findIndex(f => f.id === id)
  if (i === -1) return
  URL.revokeObjectURL(journalFiles.value[i]!.previewUrl)
  journalFiles.value.splice(i, 1)
}

/** Swap a screenshot with its neighbour — order is the conversation order. */
function moveJournalFile(index: number, delta: -1 | 1) {
  const list = journalFiles.value
  const j = index + delta
  if (j < 0 || j >= list.length) return
  ;[list[index], list[j]] = [list[j]!, list[index]!]
}

function clearJournalFiles() {
  for (const f of journalFiles.value) URL.revokeObjectURL(f.previewUrl)
  journalFiles.value = []
}

onBeforeUnmount(clearJournalFiles)

async function uploadJournalImage(file: File): Promise<string> {
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
  return key
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
      const files = journalFiles.value.map(f => f.file)
      if (!files.length) {
        toast.add({ title: 'Selecciona al menos una imagen.', color: 'warning' })
        return
      }
      // Upload everything first; the entry is only created once every
      // screenshot is in S3, so a failed upload never leaves a partial entry.
      const images = await Promise.all(files.map(uploadJournalImage))
      await $fetch(`/api/discord-users/${userId}/journal`, {
        method: 'POST',
        body: { type: 'image', images },
      })
      clearJournalFiles()
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
    toast.add({ title: 'Conversación analizada', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Error al analizar', description: e?.statusMessage || e?.message || '', color: 'error' })
  } finally {
    analyzingId.value = null
  }
}

// Per-user rollup: which conversation categories keep coming up for this
// member, counting a thread once per distinct category it carries.
const categoryRollup = computed(() => {
  const map = new Map<BestFitCategory, { category: BestFitCategory; count: number; primaryCount: number }>()
  for (const entry of journal.value ?? []) {
    if (entry.analysisStatus !== 'done' || !isDeltaResult(entry)) continue
    const result = entry.analysisResult!
    const cats = new Set<BestFitCategory>([
      result.best_fit_category,
      ...(result.additional_categories ?? []),
    ])
    for (const cat of cats) {
      const existing = map.get(cat) ?? { category: cat, count: 0, primaryCount: 0 }
      existing.count++
      if (cat === result.best_fit_category) existing.primaryCount++
      map.set(cat, existing)
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
})

/** The open follow-up for this member, if any — surfaced above the timeline. */
const openFollowUps = computed(() =>
  (journal.value ?? []).filter(e => e.followUpStatus === 'pending' && isDeltaResult(e)),
)

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

// ══ Móvil (<768px): cabecera compacta, acciones rápidas, pestañas ══
// El CSS solo oculta los paneles inactivos en móvil; en escritorio se ve todo.
const mTab = ref<'resumen' | 'bitacora' | 'actividad'>('resumen')

const tierBadges = computed(() =>
  (user.value?.roles ?? []).filter((r: string) => roleClass[r]).map((r: string) => ({ label: r.replace(/\.$/, ''), cls: roleClass[r] })),
)

const whatsappUrl = computed(() => {
  const digits = (contact.value?.phone ?? '').replace(/\D/g, '')
  return digits.length >= 8 ? `https://wa.me/${digits}` : null
})

// Seguimiento abierto con fecha de recontacto más próxima.
const nextStep = computed(() => {
  const time = (e: JournalEntry) => (e.recontactDate ? new Date(e.recontactDate).getTime() : Number.POSITIVE_INFINITY)
  const entry = [...openFollowUps.value].sort((a, b) => time(a) - time(b))[0]
  const f = entry?.analysisResult?.follow_up
  if (!entry || !f) return null
  return {
    id: entry._id,
    action: actionTypeLabel(f.action_type),
    objective: f.objective,
    message: f.suggested_message_es,
    date: formatDay(entry.recontactDate),
    overdue: !!entry.recontactDate && new Date(entry.recontactDate).getTime() < Date.now(),
  }
})

// Entradas de bitácora desplegadas en móvil (plegadas por defecto).
const openEntries = ref(new Set<string>())
function toggleEntry(id: string) {
  const next = new Set(openEntries.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  openEntries.value = next
}
function isLongEntry(entry: JournalEntry) {
  return entry.analysisStatus === 'done' || (entry.type === 'text' && entry.content.length > 220)
}

async function goToEntry(id: string) {
  mTab.value = 'bitacora'
  if (!openEntries.value.has(id)) toggleEntry(id)
  await nextTick()
  document.getElementById(`entry-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const composerOpen = ref(false)

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
      <!-- ══ Móvil: cabecera compacta + acciones + siguiente paso + pestañas ══ -->
      <div class="pm-head">
        <div class="pm-av">
          <img v-if="user.avatarUrl" :src="user.avatarUrl" :alt="user.username">
          <template v-else>{{ initial(user.username) }}</template>
          <span v-if="engagement.state === 'active'" class="pm-online" />
        </div>
        <div class="pm-id">
          <h1 class="pm-name">{{ user.username }}</h1>
          <div class="pm-badges">
            <span v-for="t in tierBadges" :key="t.label" class="stc-badge" :class="t.cls">{{ t.label }}</span>
            <span class="stc-badge" :class="ENGAGEMENT_TONE[engagement.color]">{{ engagement.label }}</span>
            <span v-if="user.removedAt" class="stc-badge red">Eliminado</span>
          </div>
          <div v-if="user.joinedAt" class="pm-since stc-mono">Miembro {{ formatRelativeTime(user.joinedAt) }}</div>
        </div>
      </div>

      <nav class="pm-acts" aria-label="Acciones rápidas">
        <a :href="`discord://-/users/${user._id}`" class="pm-act">
          <svg viewBox="0 0 24 24" fill="currentColor" class="pm-act-i" aria-hidden="true">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.055 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.19.372-.287a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.097.246.193.373.287a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
          Discord
        </a>
        <a v-if="whatsappUrl" :href="whatsappUrl" target="_blank" rel="noopener" class="pm-act">
          <UIcon name="i-lucide-message-circle" class="pm-act-i" />WhatsApp
        </a>
        <span v-else class="pm-act off" aria-disabled="true" title="Sin teléfono en ClickFunnels">
          <UIcon name="i-lucide-message-circle" class="pm-act-i" />WhatsApp
        </span>
        <a v-if="contact?.email" :href="`mailto:${contact.email}`" class="pm-act">
          <UIcon name="i-lucide-mail" class="pm-act-i" />Email
        </a>
        <span v-else class="pm-act off" aria-disabled="true" title="Sin email en ClickFunnels">
          <UIcon name="i-lucide-mail" class="pm-act-i" />Email
        </span>
        <NuxtLink :to="`/meetings?userId=${user._id}`" class="pm-act">
          <UIcon name="i-lucide-calendar-days" class="pm-act-i" />Reuniones
        </NuxtLink>
      </nav>

      <section v-if="nextStep" class="pm-next" aria-label="Siguiente paso">
        <div class="pm-next-head">
          <span class="pm-next-ey"><UIcon name="i-lucide-sparkles" class="w-3.5 h-3.5" />Siguiente paso · IA</span>
          <span v-if="nextStep.date" class="pm-next-date stc-mono" :class="{ overdue: nextStep.overdue }">
            <UIcon name="i-lucide-calendar-clock" class="w-3.5 h-3.5" />{{ nextStep.date }}
          </span>
        </div>
        <div class="pm-next-t">{{ nextStep.action }}</div>
        <p v-if="nextStep.objective" class="pm-next-obj">{{ nextStep.objective }}</p>
        <div class="pm-next-btns">
          <button v-if="nextStep.message" type="button" class="stc-btn sm gold" @click="copyMessage(nextStep.message)">
            <UIcon name="i-lucide-copy" class="w-3.5 h-3.5" />Copiar mensaje
          </button>
          <button type="button" class="stc-btn sm" @click="goToEntry(nextStep.id)">Ver en bitácora</button>
        </div>
      </section>

      <div class="pm-tabs" role="tablist" aria-label="Secciones del perfil">
        <button type="button" role="tab" :aria-selected="mTab === 'resumen'" :class="{ on: mTab === 'resumen' }" @click="mTab = 'resumen'">Resumen</button>
        <button type="button" role="tab" :aria-selected="mTab === 'bitacora'" :class="{ on: mTab === 'bitacora' }" @click="mTab = 'bitacora'">
          Bitácora<span v-if="journal?.length" class="pm-tab-n stc-mono">{{ journal.length }}</span>
        </button>
        <button type="button" role="tab" :aria-selected="mTab === 'actividad'" :class="{ on: mTab === 'actividad' }" @click="mTab = 'actividad'">Actividad</button>
      </div>

      <!-- Resumen (móvil): métricas clave -->
      <div class="pm-pane pm-only" :class="{ 'pm-hidden': mTab !== 'resumen' }">
        <div class="pm-stats stc-panel">
          <div><b class="gold">{{ user.meetingCount }}</b><span>reuniones</span></div>
          <div>
            <USkeleton v-if="activityPending" class="h-5 w-10 mx-auto" />
            <b v-else>{{ activity?.totals?.last30 ?? 0 }}</b><span>msgs 30d</span>
          </div>
          <div><b class="sm">{{ lastActive ? formatRelativeTime(lastActive) : 'nunca' }}</b><span>última actividad</span></div>
        </div>
      </div>

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

      <div class="pm-pane" :class="{ 'pm-hidden': mTab !== 'resumen' }">
      <!-- ── Contacto (ClickFunnels) ───────────────────────── -->
      <section class="stc-panel">
        <div class="stc-panel-head">
          <h2 class="stc-panel-title">
            <UIcon name="i-lucide-contact" class="w-[18px] h-[18px]" />
            Contacto
          </h2>
          <a
            v-if="contact?.profileUrl"
            :href="contact.profileUrl"
            target="_blank"
            rel="noopener"
            class="stc-btn sm"
          >
            Ver en ClickFunnels
            <UIcon name="i-lucide-external-link" class="w-3.5 h-3.5" />
          </a>
          <span v-else class="stc-badge neutral stc-mono">ClickFunnels</span>
        </div>

        <div v-if="contactPending" class="up-pad up-contact">
          <USkeleton v-for="n in 4" :key="n" class="h-11 w-full rounded-[7px]" />
        </div>
        <div v-else-if="contactError" class="stc-empty">
          <UIcon name="i-lucide-cloud-off" />
          <p>No se pudo cargar el contacto de ClickFunnels.</p>
        </div>
        <div v-else-if="!contact?.linked" class="stc-empty">
          <UIcon name="i-lucide-unlink" />
          <p>Este usuario no está vinculado a un contacto de ClickFunnels.</p>
        </div>
        <div v-else-if="contact.missing" class="stc-empty">
          <UIcon name="i-lucide-user-x" />
          <p>El contacto {{ contact.contactId }} ya no existe en ClickFunnels.</p>
        </div>
        <dl v-else class="up-pad up-contact">
          <div class="up-cf">
            <dt>Nombre completo</dt>
            <dd :class="{ muted: !contact.fullName }">{{ contact.fullName || '—' }}</dd>
          </div>
          <div class="up-cf">
            <dt>Email</dt>
            <dd v-if="contact.email"><a :href="`mailto:${contact.email}`">{{ contact.email }}</a></dd>
            <dd v-else class="muted">—</dd>
          </div>
          <div class="up-cf">
            <dt>Teléfono</dt>
            <dd v-if="contact.phone" class="stc-mono"><a :href="`tel:${contact.phone}`">{{ contact.phone }}</a></dd>
            <dd v-else class="muted">—</dd>
          </div>
          <div class="up-cf">
            <dt>Dirección</dt>
            <dd v-if="contact.address">
              <span v-for="line in formatAddress(contact.address)" :key="line" class="up-cf-line">{{ line }}</span>
            </dd>
            <dd v-else class="muted">—</dd>
          </div>
        </dl>
      </section>

      </div>

      <div class="pm-pane" :class="{ 'pm-hidden': mTab !== 'actividad' }">
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

      </div>

      <div class="pm-pane" :class="{ 'pm-hidden': mTab !== 'bitacora' }">
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
          <!-- Formulario (en móvil, plegado tras un botón) -->
          <button
            v-if="loggedIn" type="button" class="pm-compose" :class="{ open: composerOpen }"
            :aria-expanded="composerOpen" @click="composerOpen = !composerOpen"
          >
            <UIcon :name="composerOpen ? 'i-lucide-x' : 'i-lucide-plus'" class="w-4 h-4" />
            {{ composerOpen ? 'Cerrar' : 'Añadir entrada' }}
          </button>
          <div v-if="loggedIn" class="up-form" :class="{ 'pm-form-open': composerOpen }">
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
                multiple
                class="hidden"
                @change="onFilePick"
              >
              <div
                v-if="!journalFiles.length"
                class="up-drop"
                :class="{ over: journalDragging }"
                @click="journalFileInput?.click()"
                @dragover.prevent="journalDragging = true"
                @dragleave.prevent="journalDragging = false"
                @drop.prevent="onFileDrop"
              >
                <UIcon name="i-lucide-cloud-upload" class="w-7 h-7" />
                <p class="up-drop-t">Haz clic o arrastra las capturas de la conversación</p>
                <p class="up-drop-p">
                  PNG, JPG, WebP o GIF · máx. 5MB c/u · hasta {{ MAX_JOURNAL_IMAGES }} imágenes
                </p>
              </div>
              <div
                v-else
                class="up-picks"
                :class="{ over: journalDragging }"
                @dragover.prevent="journalDragging = true"
                @dragleave.prevent="journalDragging = false"
                @drop.prevent="onFileDrop"
              >
                <div class="up-picks-grid">
                  <div v-for="(img, i) in journalFiles" :key="img.id" class="up-pick">
                    <img :src="img.previewUrl" :alt="img.file.name">
                    <span class="up-pick-n stc-mono">{{ i + 1 }}</span>
                    <button
                      class="up-pick-x"
                      type="button"
                      :disabled="journalSubmitting"
                      :aria-label="`Quitar imagen ${i + 1}`"
                      @click="removeJournalFile(img.id)"
                    >
                      <UIcon name="i-lucide-x" class="w-3.5 h-3.5" />
                    </button>
                    <div v-if="journalFiles.length > 1" class="up-pick-move">
                      <button
                        type="button"
                        :disabled="journalSubmitting || i === 0"
                        :aria-label="`Mover imagen ${i + 1} antes`"
                        @click="moveJournalFile(i, -1)"
                      >
                        <UIcon name="i-lucide-chevron-left" class="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        :disabled="journalSubmitting || i === journalFiles.length - 1"
                        :aria-label="`Mover imagen ${i + 1} después`"
                        @click="moveJournalFile(i, 1)"
                      >
                        <UIcon name="i-lucide-chevron-right" class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <button
                    v-if="journalFiles.length < MAX_JOURNAL_IMAGES"
                    class="up-pick-add"
                    type="button"
                    :disabled="journalSubmitting"
                    @click="journalFileInput?.click()"
                  >
                    <UIcon name="i-lucide-plus" class="w-5 h-5" />
                    <span>Añadir</span>
                  </button>
                </div>
                <p class="up-picks-note">
                  {{ journalFiles.length }} de {{ MAX_JOURNAL_IMAGES }}
                  <template v-if="journalFiles.length > 1">
                    · se analizarán juntas como una sola conversación, en este orden
                  </template>
                </p>
              </div>
              <div class="up-form-foot">
                <p class="up-form-note">
                  Se registrará como <b>{{ session?.user?.username }}</b>
                </p>
                <button
                  class="stc-btn gold sm"
                  :disabled="journalSubmitting || !journalFiles.length"
                  @click="submitJournalEntry"
                >
                  <UIcon name="i-lucide-upload" class="w-3.5 h-3.5" />
                  {{ journalSubmitting ? 'Subiendo…' : (journalFiles.length > 1 ? `Subir ${journalFiles.length} imágenes` : 'Subir imagen') }}
                </button>
              </div>
            </template>
          </div>
          <div v-else class="up-locked">
            Inicia sesión como administrador para añadir entradas.
          </div>

          <!-- Resumen de categorías de conversación -->
          <div v-if="categoryRollup.length" class="up-rollup">
            <div class="up-rollup-head">
              <span class="up-rollup-t">
                <UIcon name="i-lucide-sparkles" class="w-4 h-4" />
                Categorías recurrentes
                <span v-if="openFollowUps.length" class="stc-badge gold" style="margin-left:4px">
                  {{ openFollowUps.length }} seguimiento{{ openFollowUps.length === 1 ? '' : 's' }} abierto{{ openFollowUps.length === 1 ? '' : 's' }}
                </span>
              </span>
              <NuxtLink to="/journal/pain-points" class="up-rollup-link">Ver panel global →</NuxtLink>
            </div>
            <div class="up-rollup-cats">
              <span v-for="row in categoryRollup" :key="row.category" class="stc-badge gold">
                {{ categoryLabel(row.category) }} · {{ row.count }}
              </span>
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
            <li
              v-for="entry in journal" :id="`entry-${entry._id}`" :key="entry._id"
              class="up-tl-item" :class="{ 'pm-open': openEntries.has(entry._id), 'pm-long': isLongEntry(entry) }"
            >
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
                <div
                  v-else-if="entryImageUrls(entry).length"
                  class="up-entry-imgs"
                  :class="{ multi: entryImageUrls(entry).length > 1 }"
                >
                  <template v-for="(url, i) in entryImageUrls(entry)" :key="i">
                    <a v-if="url" :href="url" target="_blank" rel="noopener" class="up-entry-img">
                      <img :src="url" :alt="`Captura ${i + 1} de ${entryImageUrls(entry).length}`" loading="lazy">
                      <span v-if="entryImageUrls(entry).length > 1" class="up-pick-n stc-mono">{{ i + 1 }}</span>
                    </a>
                    <div v-else class="up-entry-na">Imagen {{ i + 1 }} no disponible</div>
                  </template>
                </div>
                <div v-else class="up-entry-na">Imagen no disponible</div>

                <!-- Marca de eliminación -->
                <div v-if="entry.markedForDeletion" class="up-flag">
                  <UIcon name="i-lucide-flag" class="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Marcado para eliminar por <b>{{ entry.markedForDeletionBy }}</b></span>
                </div>

                <!-- Análisis Delta -->
                <div
                  v-if="entry.type === 'image' && entry.analysisStatus === 'done' && isDeltaResult(entry)"
                  class="up-ai"
                >
                  <div class="up-ai-head">
                    <span class="up-ai-t">
                      <UIcon name="i-lucide-sparkles" class="w-3.5 h-3.5" />
                      Análisis de conversación
                    </span>
                    <span
                      v-if="entry.followUpStatus === 'done'"
                      class="stc-badge green"
                      :title="entry.followUpDoneBy ? `Hecho por ${entry.followUpDoneBy}` : ''"
                    >
                      <UIcon name="i-lucide-check" class="w-3 h-3" />
                      Seguimiento hecho
                    </span>
                  </div>

                  <!-- Clasificación -->
                  <div class="up-ai-tags">
                    <span class="stc-badge gold">{{ categoryLabel(entry.analysisResult!.best_fit_category) }}</span>
                    <span
                      v-for="cat in entry.analysisResult!.additional_categories"
                      :key="cat"
                      class="stc-badge neutral"
                    >{{ categoryLabel(cat) }}</span>
                    <span
                      class="stc-badge"
                      :class="ALPHA_SIGNAL_TONE[entry.analysisResult!.alpha_fit_signal]"
                    >
                      Alpha: {{ ALPHA_SIGNAL_LABELS_ES[entry.analysisResult!.alpha_fit_signal] }}
                    </span>
                    <span class="stc-badge" :class="PRIORITY_TONE[entry.analysisResult!.priority]">
                      Prioridad {{ PRIORITY_LABELS_ES[entry.analysisResult!.priority] }}
                    </span>
                  </div>

                  <!-- Lectura forense -->
                  <p v-if="entry.analysisResult!.forensic_analysis" class="up-ai-p">
                    {{ entry.analysisResult!.forensic_analysis }}
                  </p>

                  <blockquote v-if="entry.analysisResult!.key_customer_quote" class="up-quote">
                    {{ entry.analysisResult!.key_customer_quote }}
                  </blockquote>

                  <!-- Qué se hizo bien / qué mejorar -->
                  <div class="up-ai-cols">
                    <div v-if="entry.analysisResult!.what_agent_did_well.length">
                      <span class="stc-eyebrow">Bien hecho</span>
                      <ul class="up-ai-list good">
                        <li v-for="(item, i) in entry.analysisResult!.what_agent_did_well" :key="i">{{ item }}</li>
                      </ul>
                    </div>
                    <div v-if="entry.analysisResult!.guideline_improvements.length">
                      <span class="stc-eyebrow">A mejorar</span>
                      <ul class="up-ai-list warn">
                        <li v-for="(item, i) in entry.analysisResult!.guideline_improvements" :key="i">{{ item }}</li>
                      </ul>
                    </div>
                  </div>

                  <!-- Patrón nuevo -->
                  <p v-if="entry.analysisResult!.newly_detected_pattern" class="up-ai-pattern">
                    <UIcon name="i-lucide-lightbulb" class="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Patrón nuevo: {{ entry.analysisResult!.newly_detected_pattern }}</span>
                  </p>

                  <!-- Siguiente acción -->
                  <div class="up-next">
                    <div class="up-next-head">
                      <span class="stc-badge solid">{{ actionTypeLabel(entry.analysisResult!.follow_up.action_type) }}</span>
                      <span v-if="entry.recontactDate" class="up-next-date stc-mono">
                        <UIcon name="i-lucide-calendar-clock" class="w-3.5 h-3.5" />
                        Recontactar el {{ formatDay(entry.recontactDate) }}
                      </span>
                    </div>
                    <p v-if="entry.analysisResult!.follow_up.objective" class="up-next-obj">
                      {{ entry.analysisResult!.follow_up.objective }}
                    </p>
                    <div v-if="entry.analysisResult!.follow_up.suggested_message_es" class="up-msg">
                      <p class="up-msg-text">{{ entry.analysisResult!.follow_up.suggested_message_es }}</p>
                      <button
                        class="stc-btn sm"
                        title="Copiar mensaje"
                        @click="copyMessage(entry.analysisResult!.follow_up.suggested_message_es)"
                      >
                        <UIcon name="i-lucide-copy" class="w-3.5 h-3.5" />
                        Copiar
                      </button>
                    </div>
                    <p v-if="entry.analysisResult!.recontact_rationale" class="up-next-why">
                      {{ entry.analysisResult!.recontact_rationale }}
                    </p>
                  </div>

                  <div v-if="entry.analysisResult!.data_quality_flags.length" class="up-ai-flags">
                    <span
                      v-for="flag in entry.analysisResult!.data_quality_flags"
                      :key="flag"
                      class="stc-badge outline long"
                    >{{ flag }}</span>
                  </div>
                </div>

                <!-- Análisis con el formato anterior (pre-Delta) -->
                <div
                  v-else-if="entry.type === 'image' && entry.analysisStatus === 'done'"
                  class="up-ai-legacy"
                >
                  <UIcon name="i-lucide-history" class="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Análisis con formato antiguo — vuelve a analizar para obtener el seguimiento.</span>
                </div>

                <div
                  v-else-if="entry.type === 'image' && entry.analysisStatus === 'error'"
                  class="up-ai-err"
                >
                  <UIcon name="i-lucide-triangle-alert" class="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Error al analizar{{ entry.analysisError ? `: ${entry.analysisError}` : '' }}</span>
                </div>

                <!-- Móvil: desplegar / plegar -->
                <button v-if="isLongEntry(entry)" type="button" class="pm-more" @click="toggleEntry(entry._id)">
                  {{ openEntries.has(entry._id) ? 'Ver menos' : (entry.analysisStatus === 'done' ? 'Ver análisis completo' : 'Ver todo') }}
                  <UIcon :name="openEntries.has(entry._id) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="w-3.5 h-3.5" />
                </button>

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

      </div>

      <div class="pm-pane" :class="{ 'pm-hidden': mTab !== 'actividad' }">
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
              <span v-for="prev in user.previousUsernames" :key="prev" class="stc-badge outline long">{{ prev }}</span>
            </div>
          </div>
          <div>
            <span class="stc-eyebrow">Roles asignados ({{ user.roles?.length || 0 }})</span>
            <p class="up-tech-p">{{ user.roles?.join(', ') || 'Sin roles asignados' }}</p>
          </div>
        </div>
      </section>
      </div>
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
/* contacto */
.up-contact { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
.up-cf {
  min-width: 0;
  background: var(--inset);
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 10px 12px;
}
.up-cf dt { font-size: 11px; color: var(--faint); text-transform: uppercase; letter-spacing: .04em; }
.up-cf dd { font-size: 13.5px; color: var(--text); margin-top: 4px; overflow-wrap: anywhere; }
.up-cf dd.muted { color: var(--faint); }
.up-cf dd a { color: var(--gold-soft); }
.up-cf dd a:hover { color: var(--gold); }
.up-cf-line { display: block; }

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

.up-drop.over,
.up-picks.over { border-color: var(--gold-ring); background: var(--gold-wash); }

.up-picks {
  padding: 12px;
  border-radius: var(--r);
  border: 1px dashed var(--line-2);
  background: var(--inset);
  transition: .15s;
}
.up-picks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 10px;
}
.up-pick {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--r-sm);
  border: 1px solid var(--line);
  overflow: hidden;
  background: var(--bg, #000);
}
.up-pick img { width: 100%; height: 100%; object-fit: cover; display: block; }
.up-pick-n {
  position: absolute;
  top: 5px; left: 5px;
  min-width: 19px; height: 19px;
  padding: 0 5px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 600;
  color: #111;
  background: var(--gold);
}
.up-pick-x,
.up-pick-move button {
  display: grid;
  place-items: center;
  width: 22px; height: 22px;
  border-radius: 6px;
  border: 0;
  color: #fff;
  background: rgba(0, 0, 0, .68);
  cursor: pointer;
  transition: .14s;
}
.up-pick-x { position: absolute; top: 5px; right: 5px; }
.up-pick-move {
  position: absolute;
  left: 5px; right: 5px; bottom: 5px;
  display: flex;
  justify-content: space-between;
}
.up-pick-x:hover:not(:disabled),
.up-pick-move button:hover:not(:disabled) { background: var(--gold); color: #111; }
.up-pick-x:disabled,
.up-pick-move button:disabled { opacity: .35; cursor: not-allowed; }
.up-pick-add {
  aspect-ratio: 1;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 4px;
  border-radius: var(--r-sm);
  border: 1px dashed var(--line-2);
  background: transparent;
  color: var(--faint);
  font-size: 11.5px;
  cursor: pointer;
  transition: .15s;
}
.up-pick-add:hover:not(:disabled) { border-color: var(--gold-ring); background: var(--gold-wash); color: var(--gold-soft); }
.up-pick-add:disabled { opacity: .35; cursor: not-allowed; }
.up-picks-note { font-size: 11.5px; color: var(--faint); margin-top: 10px; }

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
.up-rollup-cats { display: flex; flex-wrap: wrap; gap: 6px; }

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
.up-entry-imgs { display: flex; flex-wrap: wrap; gap: 8px; }
.up-entry-imgs.multi .up-entry-img img { height: 180px; max-height: 180px; }
.up-entry-img { display: block; position: relative; }
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

/* ── Análisis Delta ── */
.up-ai {
  margin-top: 12px;
  padding: 13px 15px;
  border-radius: var(--r-sm);
  background: var(--gold-wash);
  border: 1px solid var(--gold-ring);
}
.up-ai-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
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
.up-ai-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 11px; }
.up-ai-p    { font-size: 13px; color: var(--dim); line-height: 1.55; margin-top: 11px; }

.up-quote {
  margin: 11px 0 0;
  padding: 8px 12px;
  border-left: 2px solid var(--gold);
  background: rgba(0,0,0,.25);
  border-radius: 0 var(--r-xs) var(--r-xs) 0;
  font-size: 13px;
  font-style: italic;
  color: var(--text);
  overflow-wrap: anywhere;
}
html:not(.dark) .up-quote { background: rgba(0,0,0,.04); }

.up-ai-cols {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  margin-top: 14px;
}
.up-ai-list { margin-top: 7px; display: flex; flex-direction: column; gap: 5px; }
.up-ai-list li {
  position: relative;
  padding-left: 15px;
  font-size: 12.5px;
  color: var(--dim);
  line-height: 1.5;
}
.up-ai-list li::before {
  position: absolute;
  left: 0;
  top: 0;
  font-weight: 700;
}
.up-ai-list.good li::before { content: '✓'; color: var(--green); }
.up-ai-list.warn li::before { content: '→'; color: var(--gold); }

.up-ai-pattern {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--gold-soft);
}

/* siguiente acción */
.up-next {
  margin-top: 14px;
  padding-top: 13px;
  border-top: 1px solid var(--gold-ring);
}
.up-next-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.up-next-date {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: var(--dim);
}
.up-next-obj { font-size: 12.5px; color: var(--dim); line-height: 1.5; margin-top: 9px; }

.up-msg {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 10px;
  padding: 11px 12px;
  border-radius: var(--r-sm);
  background: rgba(0,0,0,.3);
  border: 1px solid var(--line);
}
html:not(.dark) .up-msg { background: #fff; }
.up-msg-text {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text);
  line-height: 1.55;
  overflow-wrap: anywhere;
}
.up-msg .stc-btn { flex-shrink: 0; }
.up-next-why { font-size: 11.5px; color: var(--faint); margin-top: 8px; }

.up-ai-flags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }

.up-ai-legacy,
.up-ai-err {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 12px;
  font-size: 11.5px;
}
.up-ai-legacy { color: var(--faint); }
.up-ai-err    { color: var(--red); }

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

/* ══ Móvil (<768px): pestañas (.pm-*) ═══════════════════════ */
.pm-head, .pm-acts, .pm-next, .pm-tabs, .pm-only, .pm-compose, .pm-more { display: none; }
.pm-pane { display: contents; }

@media (max-width: 767px) {
  .up-page { gap: 12px; }
  .up-hero { display: none; }
  .pm-pane.pm-hidden { display: none; }

  /* Cabecera compacta */
  .pm-head { display: flex; align-items: center; gap: 14px; padding: 4px 2px 0; }
  .pm-av {
    position: relative; width: 64px; height: 64px; flex-shrink: 0; border-radius: 16px;
    display: grid; place-items: center; font-family: var(--disp); font-weight: 800; font-size: 30px;
    color: var(--gold-ink); background: linear-gradient(150deg, var(--gold-soft), var(--gold));
  }
  .pm-av img { width: 100%; height: 100%; border-radius: 16px; object-fit: cover; }
  .pm-online {
    position: absolute; right: -3px; bottom: -3px; width: 15px; height: 15px; border-radius: 50%;
    background: var(--green); border: 3px solid var(--bg);
  }
  .pm-id { min-width: 0; flex: 1; }
  .pm-name {
    font-family: var(--disp); font-size: 28px; font-weight: 800; line-height: 1;
    text-transform: uppercase; letter-spacing: .01em; color: var(--text);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .pm-badges { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
  .pm-since { margin-top: 6px; font-size: 12px; color: var(--faint); }

  /* Acciones rápidas */
  .pm-acts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .pm-act {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;
    min-height: 60px; padding: 8px 4px; border-radius: 12px;
    border: 1px solid var(--line); background: var(--panel);
    color: var(--dim); font-size: 11.5px; font-weight: 600; text-decoration: none;
    -webkit-tap-highlight-color: transparent;
  }
  .pm-act:active { background: var(--panel-2); }
  .pm-act-i { width: 20px; height: 20px; color: var(--gold); }
  .pm-act.off { opacity: .45; }
  .pm-act.off .pm-act-i { color: var(--faint); }

  /* Siguiente paso */
  .pm-next {
    display: block; padding: 14px; border-radius: var(--r);
    border: 1px solid var(--gold-line); background: var(--gold-bg);
  }
  html:not(.dark) .pm-next { background: var(--gold-wash); }
  .pm-next-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .pm-next-ey {
    display: inline-flex; align-items: center; gap: 5px; color: var(--gold);
    font-size: 10.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
  }
  .pm-next-date { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--dim); }
  .pm-next-date.overdue { color: var(--red); }
  .pm-next-t { margin-top: 8px; font-size: 16px; font-weight: 700; color: var(--text); }
  .pm-next-obj {
    margin-top: 4px; font-size: 13.5px; line-height: 1.5; color: var(--dim);
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  .pm-next-btns { display: flex; gap: 8px; margin-top: 12px; }
  .pm-next-btns .stc-btn { flex: 1; min-height: 40px; justify-content: center; }

  /* Pestañas: subrayado, fijas bajo la barra superior */
  .pm-tabs {
    position: sticky; top: 0; z-index: 10;
    display: flex; margin: 0 -16px; padding: 0 16px;
    background: var(--bg); border-bottom: 1px solid var(--line);
  }
  .pm-tabs button {
    flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    min-height: 46px; border: 0; background: transparent; cursor: pointer;
    color: var(--dim); font-family: var(--ui); font-size: 14px; font-weight: 600;
    border-bottom: 2px solid transparent; margin-bottom: -1px;
  }
  .pm-tabs button.on { color: var(--gold-soft); border-bottom-color: var(--gold); }
  .pm-tab-n {
    font-size: 11px; padding: 1px 6px; border-radius: 999px; background: var(--line); color: var(--dim);
  }
  .pm-tabs button.on .pm-tab-n { background: var(--gold-wash); color: var(--gold-soft); }

  /* Resumen: métricas */
  .pm-only { display: contents; }
  .pm-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 14px 6px; text-align: center; }
  .pm-stats > div { display: flex; flex-direction: column; gap: 3px; min-width: 0; padding: 0 4px; }
  .pm-stats > div + div { border-left: 1px solid var(--line); }
  .pm-stats b { font-family: var(--disp); font-size: 28px; font-weight: 800; line-height: 1; color: var(--text); }
  .pm-stats b.gold { color: var(--gold); }
  .pm-stats b.sm { font-family: var(--ui); font-size: 14px; font-weight: 700; line-height: 28px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pm-stats span { font-size: 11px; color: var(--faint); }
  /* ya están en Resumen */
  .up-stats { display: none; }
  .up-stats + .up-block { margin-top: 0; }

  /* Bitácora: formulario plegado tras un botón */
  .pm-compose {
    display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%;
    min-height: 44px; border-radius: var(--r-sm); cursor: pointer;
    border: 1px dashed var(--gold-ring); background: transparent;
    color: var(--gold-soft); font-family: var(--ui); font-size: 14px; font-weight: 600;
  }
  .pm-compose.open { border-style: solid; border-color: var(--line-2); color: var(--dim); margin-bottom: 12px; }
  .up-form:not(.pm-form-open) { display: none; }
  .up-form { margin-bottom: 4px; }

  /* Entradas plegadas: resumen escaneable, el resto bajo "Ver análisis completo" */
  .up-tl-item.pm-long:not(.pm-open) .up-quote,
  .up-tl-item.pm-long:not(.pm-open) .up-ai-cols,
  .up-tl-item.pm-long:not(.pm-open) .up-ai-pattern,
  .up-tl-item.pm-long:not(.pm-open) .up-next-obj,
  .up-tl-item.pm-long:not(.pm-open) .up-msg,
  .up-tl-item.pm-long:not(.pm-open) .up-next-why,
  .up-tl-item.pm-long:not(.pm-open) .up-ai-flags,
  .up-tl-item.pm-long:not(.pm-open) .up-ai-legacy,
  .up-tl-item.pm-long:not(.pm-open) .up-entry-actions { display: none; }
  .up-tl-item.pm-long:not(.pm-open) .up-ai-p,
  .up-tl-item.pm-long:not(.pm-open) .up-entry-text {
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  .up-tl-item.pm-long:not(.pm-open) .up-entry-imgs .up-entry-img img { height: 120px; max-height: 120px; }
  .up-tl-item.pm-long:not(.pm-open) .up-entry-imgs { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }

  .up-tl-item { scroll-margin-top: 62px; } /* bajo las pestañas fijas */

  /* Más ancho útil: carril de la línea de tiempo y rellenos más estrechos */
  .up-timeline { padding-left: 16px; }
  .up-timeline::before { left: 3px; }
  .up-tl-node { left: -17px; width: 9px; height: 9px; }
  .up-entry { padding: 12px; }
  .up-ai { padding: 11px 12px; }
  .up-ai-tags { gap: 5px; }

  .pm-more {
    display: inline-flex; align-items: center; gap: 5px; margin-top: 12px; padding: 0;
    border: 0; background: transparent; cursor: pointer;
    color: var(--gold-soft); font-family: var(--ui); font-size: 13px; font-weight: 600;
  }
}
</style>
