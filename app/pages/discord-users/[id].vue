<script setup lang="ts">
const badgeVariant = useBadgeVariant()
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
}

const journalType = ref<'text' | 'image'>('text')
const journalText = ref('')
const journalSubmitting = ref(false)
const journalFile = ref<File | null>(null)
const journalFileInput = ref<HTMLInputElement | null>(null)

const ALLOWED_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const journalTypeItems = [
  { value: 'text', label: 'Texto', icon: 'i-heroicons-document-text' },
  { value: 'image', label: 'Imagen', icon: 'i-heroicons-photo' },
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

useSeoMeta({
  title: computed(() => user.value ? `${user.value.username} - STC Control` : 'Usuario - STC Control'),
  description: computed(() => user.value ? `Perfil de ${user.value.username} en el Stock Trading Club.` : 'Perfil de usuario.'),
  ogTitle: computed(() => user.value ? `${user.value.username} - STC Control` : 'Usuario - STC Control'),
})

const colorMap: Record<string, any> = {
  'Alpha.': 'warning',
  'Alpha': 'warning',
  'Delta': 'info',
  'Delta.': 'info',
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
  if (!cell.date) return 'bg-transparent'
  if (cell.count === 0) return 'bg-gray-100 dark:bg-gray-800'
  const pct = cell.count / heatmapMax.value
  if (pct < 0.25) return 'bg-primary/20'
  if (pct < 0.5) return 'bg-primary/40'
  if (pct < 0.75) return 'bg-primary/70'
  return 'bg-primary'
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
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto">
    <div class="mb-8 flex justify-between items-center">
      <UButton to="/discord-users" icon="i-heroicons-arrow-left" color="neutral" variant="ghost">Volver al directorio</UButton>
    </div>

    <div v-if="pending" class="space-y-6">
      <UCard>
        <div class="flex items-center gap-4">
          <USkeleton class="h-16 w-16 rounded-lg" />
          <div class="space-y-2">
            <USkeleton class="h-6 w-48" />
            <USkeleton class="h-4 w-32" />
          </div>
        </div>
      </UCard>
      <USkeleton class="h-64 w-full" />
    </div>

    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg text-center">
      <UIcon name="i-heroicons-exclamation-circle" class="text-4xl text-red-500 mb-2" />
      <h2 class="text-xl font-bold text-red-700 dark:text-red-400">Usuario no encontrado</h2>
      <p class="text-red-600 dark:text-red-300 mt-1">{{ error.message }}</p>
      <UButton to="/discord-users" class="mt-4" color="neutral">Volver a la lista</UButton>
    </div>

    <div v-else-if="user" class="space-y-6">
      <!-- Profile Header -->
      <UCard>
        <div class="flex flex-col md:flex-row md:items-center gap-6">
          <UAvatar
            :alt="user.username"
            size="xl"
            :ui="{ rounded: 'rounded-2xl' }"
            class="ring-4 ring-primary/10"
          />
          <div class="flex-1">
            <div class="flex items-center gap-3 flex-wrap">
              <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{{ user.username }}</h1>
              <UBadge :color="engagement.color" :variant="badgeVariant" size="md">
                {{ engagement.label }}
              </UBadge>
              <UBadge color="neutral" :variant="badgeVariant" size="sm">ID: {{ user._id }}</UBadge>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <UBadge
                v-for="role in user.roles"
                :key="role"
                :color="colorMap[role] || 'neutral'"
                :variant="colorMap[role] ? 'subtle' : 'soft'"
                class="capitalize"
              >
                {{ role }}
              </UBadge>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Engagement Card -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2 font-bold">
            <UIcon name="i-heroicons-chart-bar" class="text-primary" />
            Actividad
          </div>
        </template>

        <!-- Three stat tiles -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="p-4 rounded-xl bg-primary/5 border border-primary/10">
            <div class="text-xs font-bold uppercase tracking-wider text-primary/70">Reuniones</div>
            <div class="mt-1 flex items-baseline gap-2">
              <span class="text-3xl font-black text-primary">{{ user.meetingCount }}</span>
              <span class="text-xs text-gray-500">total</span>
            </div>
            <div v-if="user.lastMeetingAt" class="text-xs text-gray-500 mt-1">
              Última: {{ new Date(user.lastMeetingAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) }}
            </div>
            <div v-else class="text-xs text-gray-400 mt-1">Sin reuniones</div>
          </div>

          <div class="p-4 rounded-xl bg-info/5 border border-info/10">
            <div class="text-xs font-bold uppercase tracking-wider text-info/70">Mensajes</div>
            <div v-if="activityPending">
              <USkeleton class="h-8 w-16 mt-1" />
            </div>
            <div v-else class="mt-1 flex items-baseline gap-2">
              <span class="text-3xl font-black text-info">{{ activity?.totals?.last30 ?? 0 }}</span>
              <span class="text-xs text-gray-500">30d</span>
            </div>
            <div v-if="!activityPending && messagesDelta" class="text-xs mt-1 flex items-center gap-1">
              <UIcon
                :name="messagesDelta.up ? 'i-heroicons-arrow-trending-up' : 'i-heroicons-arrow-trending-down'"
                :class="messagesDelta.up ? 'text-green-500' : 'text-red-500'"
              />
              <span :class="messagesDelta.up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                {{ messagesDelta.up ? '↑' : '↓' }} {{ messagesDelta.pct }}% vs 30d anteriores
              </span>
            </div>
            <div v-else-if="!activityPending" class="text-xs text-gray-400 mt-1">Sin datos previos</div>
          </div>

          <div class="p-4 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div class="text-xs font-bold uppercase tracking-wider text-gray-500">Última actividad</div>
            <div class="mt-1">
              <UTooltip v-if="lastActive" :text="new Date(lastActive).toLocaleString('es-ES')">
                <span class="text-2xl font-black text-gray-900 dark:text-white">{{ formatRelativeTime(lastActive) }}</span>
              </UTooltip>
              <span v-else class="text-2xl font-black text-gray-400">nunca</span>
            </div>
            <div class="text-xs text-gray-500 mt-1">mensajes y reuniones</div>
          </div>
        </div>

        <!-- Heatmap -->
        <div class="mt-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-bold text-gray-700 dark:text-gray-300">Actividad 90 días</h3>
            <div class="flex items-center gap-1 text-xs text-gray-500">
              <span>Menos</span>
              <div class="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-800" />
              <div class="w-3 h-3 rounded-sm bg-primary/20" />
              <div class="w-3 h-3 rounded-sm bg-primary/40" />
              <div class="w-3 h-3 rounded-sm bg-primary/70" />
              <div class="w-3 h-3 rounded-sm bg-primary" />
              <span>Más</span>
            </div>
          </div>
          <div v-if="activityPending">
            <USkeleton class="h-24 w-full" />
          </div>
          <div v-else class="flex gap-1 overflow-x-auto">
            <div v-for="(col, ci) in heatmap" :key="ci" class="flex flex-col gap-1">
              <UTooltip v-for="(cell, ri) in col" :key="`${ci}-${ri}`" :text="cell.tooltip || ''">
                <div
                  class="w-3.5 h-3.5 rounded-sm relative"
                  :class="cellClass(cell)"
                >
                  <div
                    v-if="cell.isMeetingDay"
                    class="absolute inset-0 rounded-sm ring-2 ring-amber-400"
                  />
                </div>
              </UTooltip>
            </div>
          </div>
          <p class="text-xs text-gray-400 mt-2">
            Seguimiento desde el inicio del sistema — los días vacíos anteriores no son ceros reales.
          </p>
        </div>

        <!-- Top channels -->
        <div v-if="!activityPending && topChannels.length > 1" class="mt-6">
          <h3 class="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Canales más activos (30d)</h3>
          <div class="space-y-2">
            <div v-for="c in topChannels" :key="c.channelId" class="flex items-center gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between text-sm">
                  <span class="truncate text-gray-700 dark:text-gray-300">
                    #{{ c.channelName || c.channelId }}
                  </span>
                  <span class="text-gray-500 tabular-nums">{{ c.count }}</span>
                </div>
                <div class="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full mt-1 overflow-hidden">
                  <div
                    class="h-full bg-primary"
                    :style="{ width: `${(c.count / topChannelMax) * 100}%` }"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-6">
          <UButton
            :to="`/meetings?userId=${user._id}`"
            icon="i-heroicons-calendar-days"
            block
            color="primary"
          >
            Ver historial completo
          </UButton>
        </div>
      </UCard>

      <!-- Watched Videos Card -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2 font-bold">
              <UIcon name="i-heroicons-play-circle" class="text-primary" />
              Vídeos vistos
            </div>
            <UBadge v-if="!watchedPending" color="neutral" :variant="badgeVariant" size="sm">
              {{ watched?.total ?? 0 }} {{ watched?.total === 1 ? 'vídeo' : 'vídeos' }}
            </UBadge>
          </div>
        </template>

        <div v-if="watchedPending" class="space-y-3">
          <USkeleton v-for="n in 3" :key="n" class="h-14 w-full" />
        </div>
        <div
          v-else-if="!watched?.recent?.length"
          class="text-center py-6 text-sm text-gray-400"
        >
          Aún no ha visto ningún vídeo.
        </div>
        <ul v-else class="space-y-2">
          <li
            v-for="video in watched.recent"
            :key="video._id"
            class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
          >
            <UIcon name="i-heroicons-film" class="text-primary text-xl shrink-0 hidden sm:block" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-film" class="text-primary text-base shrink-0 sm:hidden" />
                <div class="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ formatVideoTitle(video.videoKey) }}
                </div>
              </div>
              <div class="flex items-center gap-2 mt-1.5">
                <div class="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-primary transition-all"
                    :style="{ width: `${videoProgressPct(video)}%` }"
                  />
                </div>
                <span class="text-xs text-gray-500 tabular-nums shrink-0">
                  {{ videoProgressPct(video) }}%
                </span>
              </div>
            </div>
            <UTooltip :text="new Date(video.updatedAt).toLocaleString('es-ES')">
              <div class="text-xs text-gray-500 sm:text-right shrink-0 sm:min-w-[6rem]">
                {{ formatRelativeTime(video.updatedAt) }}
              </div>
            </UTooltip>
          </li>
        </ul>
      </UCard>

      <!-- Bitácora (Journal) Card -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2 font-bold">
              <UIcon name="i-heroicons-book-open" class="text-primary" />
              Bitácora
            </div>
            <UBadge v-if="!journalPending" color="neutral" :variant="badgeVariant" size="sm">
              {{ journal?.length ?? 0 }} {{ journal?.length === 1 ? 'entrada' : 'entradas' }}
            </UBadge>
          </div>
        </template>

        <!-- Entry form -->
        <div v-if="loggedIn" class="mb-6">
          <div class="flex flex-wrap gap-2 mb-3">
            <UButton
              v-for="item in journalTypeItems"
              :key="item.value"
              :icon="item.icon"
              :color="journalType === item.value ? 'primary' : 'neutral'"
              :variant="journalType === item.value ? 'solid' : 'outline'"
              size="sm"
              @click="journalType = item.value as 'text' | 'image'"
            >
              {{ item.label }}
            </UButton>
          </div>

          <div v-if="journalType === 'text'" class="space-y-3">
            <UTextarea
              v-model="journalText"
              placeholder="Escribe una nota sobre este usuario..."
              :rows="4"
              autoresize
              class="w-full"
              :ui="{ base: 'w-full' }"
            />
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <p class="text-xs text-gray-500">
                Se registrará como
                <span class="font-medium text-gray-700 dark:text-gray-300">{{ session?.user?.username }}</span>
              </p>
              <UButton
                icon="i-heroicons-plus"
                color="primary"
                :loading="journalSubmitting"
                :disabled="!journalText.trim()"
                @click="submitJournalEntry"
              >
                Añadir entrada
              </UButton>
            </div>
          </div>
          <div v-else class="space-y-3">
            <input
              ref="journalFileInput"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              class="hidden"
              @change="onFilePick"
            >
            <div
              v-if="!journalFile"
              class="p-6 rounded-lg bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-200 dark:border-gray-700 text-center cursor-pointer hover:border-primary transition-colors"
              @click="journalFileInput?.click()"
            >
              <UIcon name="i-heroicons-cloud-arrow-up" class="text-3xl text-gray-400" />
              <p class="text-sm text-gray-600 dark:text-gray-300 mt-2">
                Haz clic para seleccionar una imagen
              </p>
              <p class="text-xs text-gray-400 mt-1">
                PNG, JPG, WebP o GIF · máx. 5MB
              </p>
            </div>
            <div
              v-else
              class="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
            >
              <div class="flex items-center gap-3 min-w-0">
                <UIcon name="i-heroicons-photo" class="text-primary text-xl shrink-0" />
                <div class="min-w-0">
                  <div class="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {{ journalFile.name }}
                  </div>
                  <div class="text-xs text-gray-500">
                    {{ (journalFile.size / 1024).toFixed(1) }} KB
                  </div>
                </div>
              </div>
              <UButton
                icon="i-heroicons-x-mark"
                color="neutral"
                variant="ghost"
                size="xs"
                :disabled="journalSubmitting"
                @click="clearJournalFile"
              />
            </div>
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <p class="text-xs text-gray-500">
                Se registrará como
                <span class="font-medium text-gray-700 dark:text-gray-300">{{ session?.user?.username }}</span>
              </p>
              <UButton
                icon="i-heroicons-arrow-up-tray"
                color="primary"
                :loading="journalSubmitting"
                :disabled="!journalFile"
                @click="submitJournalEntry"
              >
                Subir imagen
              </UButton>
            </div>
          </div>
        </div>
        <div v-else class="mb-6 text-sm text-gray-500 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
          Inicia sesión como administrador para añadir entradas.
        </div>

        <!-- Timeline -->
        <div v-if="journalPending" class="space-y-3">
          <USkeleton v-for="n in 3" :key="n" class="h-16 w-full" />
        </div>
        <div
          v-else-if="!journal?.length"
          class="text-center py-8 text-sm text-gray-400"
        >
          Aún no hay entradas en la bitácora.
        </div>
        <ol v-else class="relative border-l-2 border-gray-200 dark:border-gray-700 ml-3 space-y-6">
          <li
            v-for="entry in journal"
            :key="entry._id"
            class="ml-6"
          >
            <span class="absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full bg-primary ring-4 ring-white dark:ring-gray-900" />
            <div class="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <div class="flex items-center justify-between gap-2 flex-wrap mb-2">
                <div class="flex items-center gap-2 text-sm">
                  <UIcon
                    :name="entry.type === 'image' ? 'i-heroicons-photo' : 'i-heroicons-document-text'"
                    class="text-primary"
                  />
                  <span class="font-bold text-gray-900 dark:text-white">{{ entry.adminUsername }}</span>
                </div>
                <UTooltip :text="new Date(entry.createdAt).toLocaleString('es-ES')">
                  <span class="text-xs text-gray-500">{{ formatRelativeTime(entry.createdAt) }}</span>
                </UTooltip>
              </div>
              <p
                v-if="entry.type === 'text'"
                class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words"
              >
                {{ entry.content }}
              </p>
              <a
                v-else-if="entry.imageUrl"
                :href="entry.imageUrl"
                target="_blank"
                rel="noopener"
                class="block"
              >
                <img
                  :src="entry.imageUrl"
                  :alt="entry.content"
                  class="max-h-80 w-auto rounded-md border border-gray-200 dark:border-gray-700"
                  loading="lazy"
                >
              </a>
              <div v-else class="text-xs text-gray-400 italic">Imagen no disponible</div>
            </div>
          </li>
        </ol>
      </UCard>

      <!-- Technical Info Card -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2 font-bold">
            <UIcon name="i-heroicons-fingerprint" class="text-primary" />
            Información técnica
          </div>
        </template>
        <div class="space-y-4">
          <div v-if="user.previousUsernames?.length">
            <span class="text-xs font-bold uppercase text-gray-400 block mb-2">Nombres anteriores</span>
            <div class="flex flex-wrap gap-1">
              <UBadge v-for="prev in user.previousUsernames" :key="prev" variant="outline" size="xs">
                {{ prev }}
              </UBadge>
            </div>
          </div>
          <div>
            <span class="text-xs font-bold uppercase text-gray-400 block mb-2">Roles asignados ({{ user.roles?.length || 0 }})</span>
            <div class="text-sm text-gray-500 line-clamp-3">
              {{ user.roles?.join(', ') || 'Sin roles asignados' }}
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
