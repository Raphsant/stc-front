<script setup lang="ts">
const { data: discordInfo, pending: discordPending } = await useFetch('https://stc.snuuy.com/webhook/discord-info', {
  method: 'GET',
  lazy: true,
})
const { data: botStatus, pending: statusPending } = await useFetch('https://stc.snuuy.com/health', { lazy: true })
const { data: meetings, pending: meetingsPending } = await useFetch('/api/meetings', { lazy: true })
const { data: latestMeetings, pending: activityPending } = await useFetch('/api/meetings', { query: { limit: 5 }, lazy: true })

const quickStats = computed(() => [
  { 
    label: 'Nombre del Servidor', 
    value: discordInfo.value?.guildName, 
    pending: discordPending.value,
    icon: 'i-heroicons-server-stack-20-solid', 
    color: 'text-primary-500' 
  },
  { 
    label: 'Miembros Totales', 
    value: discordInfo.value?.memberCount?.toLocaleString(), 
    pending: discordPending.value,
    icon: 'i-heroicons-users-20-solid', 
    color: 'text-blue-500' 
  },
  { 
    label: 'Meetings Registrados', 
    value: meetings.value?.length, 
    pending: meetingsPending.value,
    icon: 'i-heroicons-video-camera-20-solid', 
    color: 'text-green-500' 
  },
  { 
    label: 'Estado del Bot', 
    value: botStatus.value?.status === 'UP' ? 'ACTIVO' : 'OFFLINE', 
    pending: statusPending.value,
    icon: 'i-heroicons-signal-20-solid', 
    color: botStatus.value?.status === 'UP' ? 'text-green-500' : 'text-red-500' 
  },
])

function formatUptime(seconds: number) {
  if (!seconds) return '0s'
  const d = Math.floor(seconds / (3600 * 24))
  const h = Math.floor((seconds % (3600 * 24)) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  
  const parts = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m}m`)
  return parts.join(' ') || '0m'
}

function timeAgo(date: string | Date) {
  if (!date) return 'n/a'
  const past = new Date(date).getTime()
  const now = new Date().getTime()
  const seconds = Math.floor((now - past) / 1000)

  if (isNaN(seconds) || seconds < 0) return 'recién ahora'
  if (seconds < 60) return 'hace unos segundos'
  
  const intervals = {
    año: 31536000,
    mes: 2592000,
    día: 86400,
    hora: 3600,
    minuto: 60
  }

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const counter = Math.floor(seconds / secondsInUnit)
    if (counter >= 1) {
      if (counter === 1) return `hace 1 ${unit}`
      const plural = unit === 'mes' ? 'meses' : `${unit}s`
      return `hace ${counter} ${plural}`
    }
  }
  
  return 'recién ahora'
}
</script>

<template>
  <div class="space-y-8">
    <!-- Quick Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <UCard v-for="stat in quickStats" :key="stat.label" class="bg-neutral-900/50 border-neutral-800">
        <div class="flex items-center gap-4">
          <div :class="`p-3 rounded-lg ${stat.color} bg-opacity-10`">
            <UIcon :name="stat.icon" :class="`w-6 h-6 ${stat.color}`" />
          </div>
          <div class="flex-1 overflow-hidden">
            <p class="text-sm text-neutral-400 font-medium">{{ stat.label }}</p>
            <USkeleton v-if="stat.pending" class="h-6 w-24 mt-1" />
            <p v-else class="text-xl font-bold tracking-tight truncate">{{ stat.value || '0' }}</p>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Bot Health & Performance -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <UCard class="bg-neutral-900/50 border-neutral-800">
        <template #header>
           <h3 class="font-semibold text-neutral-200">Estado del Sistema</h3>
        </template>
        <div class="space-y-4">
          <div class="flex items-center justify-between p-3 rounded-lg bg-neutral-800/50">
            <div class="flex items-center gap-3">
              <UIcon name="i-heroicons-clock-20-solid" class="text-primary-500" />
              <span class="text-sm">Tiempo Activo</span>
            </div>
            <USkeleton v-if="statusPending" class="h-4 w-16" />
            <span v-else class="text-sm font-mono">{{ formatUptime(botStatus?.uptime) }}</span>
          </div>
          <div class="flex items-center justify-between p-3 rounded-lg bg-neutral-800/50">
            <div class="flex items-center gap-3">
              <UIcon name="i-heroicons-bolt-20-solid" class="text-primary-500" />
              <span class="text-sm">Conexión Discord</span>
            </div>
            <USkeleton v-if="statusPending" class="h-4 w-24" />
            <span v-else class="text-sm font-mono">{{ botStatus?.discord === 'Connected' ? 'Conectado' : 'Desconectado' }}</span>
          </div>
          <div class="flex items-center justify-between p-3 rounded-lg bg-neutral-800/50">
            <div class="flex items-center gap-3">
              <UIcon name="i-heroicons-signal-20-solid" class="text-primary-500" />
              <span class="text-sm">Servicio</span>
            </div>
            <USkeleton v-if="statusPending" class="h-6 w-20" />
            <UBadge v-else :color="botStatus?.status === 'UP' ? 'primary' : 'red'" size="sm" variant="soft">
              {{ botStatus?.status === 'UP' ? 'EN LÍNEA' : 'FUERA DE SERVICIO' }}
            </UBadge>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Últimas Actividades -->
    <UCard class="bg-neutral-900/50 border-neutral-800">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-neutral-200">Actividad Reciente</h3>
          <UButton to="/meetings" color="neutral" variant="ghost" size="sm" icon="i-heroicons-arrow-right-20-solid">Ver Todo</UButton>
        </div>
      </template>

      <div class="divide-y divide-neutral-800">
        <div v-if="activityPending" class="space-y-4 py-4">
          <div v-for="i in 3" :key="i" class="flex items-center gap-4">
            <USkeleton class="h-10 w-10 rounded-lg" />
            <div class="flex-1 space-y-2">
              <USkeleton class="h-4 w-full" />
              <USkeleton class="h-3 w-24" />
            </div>
          </div>
        </div>

        <div v-else-if="!latestMeetings?.length" class="py-8 text-center text-neutral-500 text-sm">
          No hay actividad reciente.
        </div>
        
        <template v-else>
          <div v-for="meeting in latestMeetings.slice(0, 5)" :key="meeting._id" class="py-4 flex items-center justify-between first:pt-0 last:pb-0">
            <div class="flex items-center gap-4">
              <UAvatarGroup size="sm" :max="1">
                <UAvatar 
                  v-if="meeting.participants?.[0]"
                  :alt="meeting.participants[0].username"
                  :ui="{ rounded: 'rounded-lg' }"
                />
                <div v-else class="p-2 rounded-lg bg-neutral-800 text-neutral-500">
                  <UIcon name="i-heroicons-user" />
                </div>
              </UAvatarGroup>
              <div>
                <p class="text-sm font-medium">
                  <span class="text-primary-500" v-if="meeting.participants?.[0]">{{ meeting.participants[0].username }}</span>
                  <span class="text-primary-500" v-else>Alguien</span>
                  <span class="text-neutral-400"> se registró para el meeting </span>
                  <span class="text-neutral-200 font-semibold">{{ meeting.meetingId || meeting.name }}</span>
                </p>
                <p class="text-xs text-neutral-500 flex items-center gap-1">
                  <UIcon name="i-heroicons-clock" class="w-3 h-3" />
                  {{ timeAgo(meeting.occurredAt) }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <div v-if="meeting.participants?.length > 1" class="hidden sm:block">
                <UBadge variant="subtle" color="neutral" size="sm">
                  +{{ meeting.participants.length - 1 }} más
                </UBadge>
              </div>
              <UButton :to="`/meetings/${meeting._id}`" color="neutral" variant="ghost" size="sm" icon="i-heroicons-chevron-right" />
            </div>
          </div>
        </template>
      </div>
    </UCard>
  </div>
</template>
