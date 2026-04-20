<script setup lang="ts">
const badgeVariant = useBadgeVariant()
const route = useRoute()
const userId = route.params.id

const { data: user, pending, error } = useFetch(`/api/discord-users/${userId}`)
const { data: activity, pending: activityPending } = useFetch(`/api/discord-users/${userId}/activity`)

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
