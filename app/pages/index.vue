<script setup lang="ts">
useSeoMeta({
  title: 'Dashboard - STC Control',
  description: 'Panel de control del Stock Trading Club. Estadísticas, actividad reciente y estado del sistema.',
  ogTitle: 'Dashboard - STC Control',
})

import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Filler,
} from 'chart.js'

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler)

const nuxtApp = useNuxtApp()
const {data: discordInfo, pending: discordPending} = await useFetch('https://stc.snuuy.com/webhooks/discord-info', {
  method: 'GET',
  key: 'discord-info',
  getCachedData(key) {
    return nuxtApp.payload.data[key] || nuxtApp.static.data[key]
  }
})
useSeoMeta({
  title: 'Dashboard - STC control',
  description: 'Control de Registros',
  ogTitle: 'STC - Control de Registros',
  favicon: '/favicon.ico'
})




// const { data: botStatus, pending: statusPending } = await useFetch('https://stc.snuuy.com/health', {
//   method: 'GET',
//   key: 'bot-status',
//   getCachedData(key){
//     return nuxtApp.payload.data[key] || nuxtApp.static.data[key]
//   }
// })

const { data: meetings, pending: meetingsPending } = await useFetch('/api/meetings', { lazy: true })
const {data: botStatus, pending: statusPending} = useBotStatus()


const {data: logs, pending: logsPending} = await useFetch('/api/logs', {
  query: {limit: 5},
  lazy: true
})

type Period = 'daily' | 'weekly' | 'monthly'
const period = ref<Period>('daily')

const chartFrom = ref('')
const chartTo = ref('')

function clearChartDates() {
  chartFrom.value = ''
  chartTo.value = ''
}

const { data: stats, pending: statsPending } = useFetch('/api/logs/stats', {
  query: computed(() => ({
    period: period.value,
    ...(chartFrom.value ? { from: chartFrom.value } : {}),
    ...(chartTo.value ? { to: chartTo.value } : {}),
  })),
  lazy: true,
})

const periodLabels: Record<Period, string> = {
  daily: 'Diario',
  weekly: 'Semanal',
  monthly: 'Mensual',
}

// Read the actual primary color from CSS so Chart.js canvas can use it
const primaryRgb = ref('99, 102, 241')

onMounted(() => {
  const el = document.createElement('span')
  el.className = 'bg-primary-500'
  el.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
  document.body.appendChild(el)
  const bg = getComputedStyle(el).backgroundColor
  document.body.removeChild(el)
  const match = bg.match(/\d+/g)
  if (match) primaryRgb.value = `${match[0]}, ${match[1]}, ${match[2]}`
})

const chartData = computed(() => {
  const entries = stats.value || []
  const rgb = primaryRgb.value
  return {
    labels: entries.map((e: any) => e.date),
    datasets: [{
      data: entries.map((e: any) => e.count),
      borderColor: `rgb(${rgb})`,
      borderWidth: 2,
      fill: true,
      // Gradient fill — top: primary at ~20% opacity → bottom: transparent (mirrors Nuxt UI "subtle" badge)
      backgroundColor: (context: any) => {
        const chart = context.chart
        const { ctx, chartArea } = chart
        if (!chartArea) return `rgba(${rgb}, 0.1)`
        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
        gradient.addColorStop(0, `rgba(${rgb}, 0.2)`)
        gradient.addColorStop(1, `rgba(${rgb}, 0)`)
        return gradient
      },
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: `rgb(${rgb})`,
      pointBorderColor: 'transparent',
    }],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: any) => ` ${ctx.parsed.y} registro${ctx.parsed.y !== 1 ? 's' : ''}`,
      },
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.05)' },
      ticks: { color: '#9ca3af', font: { size: 11 } },
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.05)' },
      ticks: { color: '#9ca3af', font: { size: 11 }, precision: 0 },
      beginAtZero: true,
    },
  },
}

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

function formatFullDate(date: string | Date) {
  if (!date) return 'n/a'
  const d = new Date(date)
  const datePart = d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  })
  const timePart = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).toLowerCase().replace(' ', '')

  return `${datePart} ${timePart}`
}

function formatDateOnly(date: string | Date) {
  if (!date) return 'n/a'
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  })
}

</script>

<template>
  <div v-if="statusPending">
    loading...
  </div>
  <div v-else class="space-y-8">
    <!-- Quick Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <UCard v-for="stat in quickStats" :key="stat.label" class="bg-neutral-900/50 border-neutral-800">
        <div class="flex items-center gap-4">
          <div :class="`p-3 rounded-lg ${stat.color} bg-opacity-10`">
            <UIcon :name="stat.icon" :class="`w-6 h-6 ${stat.color}`"/>
          </div>
          <div class="flex-1 overflow-hidden">
            <p class="text-sm text-neutral-400 font-medium">{{ stat.label }}</p>
            <USkeleton v-if="stat.pending" class="h-6 w-24 mt-1"/>
            <p v-else class="text-xl font-bold tracking-tight truncate">{{ stat.value || '0' }}</p>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Registration Chart -->
    <UCard class="bg-neutral-900/50 border-neutral-800">
      <template #header>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 class="font-semibold text-neutral-200">Registros por período</h3>
          <div class="flex flex-wrap items-end gap-3">
            <!-- Grouping toggles -->
            <div class="flex gap-1">
              <UButton
                v-for="p in (['daily', 'weekly', 'monthly'] as Period[])"
                :key="p"
                size="xs"
                :variant="period === p ? 'solid' : 'ghost'"
                :color="period === p ? 'primary' : 'neutral'"
                @click="period = p"
              >
                {{ periodLabels[p] }}
              </UButton>
            </div>

            <div class="h-4 w-px bg-neutral-700 hidden sm:block self-center" />

            <!-- Date range pickers -->
            <div class="flex items-end gap-2">
              <div class="flex flex-col gap-1">
                <span class="text-xs text-neutral-500">Desde</span>
                <UInput v-model="chartFrom" type="date" size="xs" class="w-32" />
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-xs text-neutral-500">Hasta</span>
                <UInput v-model="chartTo" type="date" size="xs" class="w-32" />
              </div>
              <UButton
                v-if="chartFrom || chartTo"
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-heroicons-x-mark"
                class="mb-0.5"
                @click="clearChartDates"
              />
            </div>
          </div>
        </div>
      </template>

      <div class="h-64">
        <div v-if="statsPending" class="h-full">
          <USkeleton class="w-full h-full rounded-lg" />
        </div>
        <div v-else-if="!stats?.length" class="flex items-center justify-center h-full text-neutral-500 text-sm">
          No hay datos para este período.
        </div>
        <ClientOnly v-else>
          <Line :data="chartData" :options="chartOptions" class="h-full! w-full!" />
        </ClientOnly>
      </div>
    </UCard>

    <!-- Bot Health & Performance -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <UCard class="bg-neutral-900/50 border-neutral-800">
        <template #header>
          <h3 class="font-semibold text-neutral-200">Estado del Sistema</h3>
        </template>
        <div class="space-y-4">
          <div class="flex items-center justify-between p-3 rounded-lg bg-neutral-800/50">
            <div class="flex items-center gap-3">
              <UIcon name="i-heroicons-clock-20-solid" class="text-primary-500"/>
              <span class="text-sm">Tiempo Activo</span>
            </div>
            <USkeleton v-if="statusPending" class="h-4 w-16"/>
            <span v-else class="text-sm font-mono">{{ formatUptime(botStatus?.uptime) }}</span>
          </div>
          <div class="flex items-center justify-between p-3 rounded-lg bg-neutral-800/50">
            <div class="flex items-center gap-3">
              <UIcon name="i-heroicons-bolt-20-solid" class="text-primary-500"/>
              <span class="text-sm">Conexión Discord</span>
            </div>
            <USkeleton v-if="statusPending" class="h-4 w-24"/>
            <span v-else class="text-sm font-mono">{{
                botStatus?.discord === 'Connected' ? 'Conectado' : 'Desconectado'
              }}</span>
          </div>
          <div class="flex items-center justify-between p-3 rounded-lg bg-neutral-800/50">
            <div class="flex items-center gap-3">
              <UIcon name="i-heroicons-signal-20-solid" class="text-primary-500"/>
              <span class="text-sm">Servicio</span>
            </div>
            <USkeleton v-if="statusPending" class="h-6 w-20"/>
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
          <UButton to="/meetings" color="neutral" variant="ghost" size="sm" icon="i-heroicons-arrow-right-20-solid">Ver
            Todo
          </UButton>
        </div>
      </template>

      <div class="divide-y divide-neutral-800">
        <div v-if="logsPending" class="space-y-4 py-4">
          <div v-for="i in 3" :key="i" class="flex items-center gap-4">
            <USkeleton class="h-10 w-10 rounded-lg"/>
            <div class="flex-1 space-y-2">
              <USkeleton class="h-4 w-full"/>
              <USkeleton class="h-3 w-24"/>
            </div>
          </div>
        </div>

        <div v-else-if="!logs?.length" class="py-8 text-center text-neutral-500 text-sm">
          No hay actividad reciente.
        </div>

        <template v-else>
          <div v-for="log in logs" :key="log._id"
               class="py-4 flex items-center justify-between first:pt-0 last:pb-0">
            <div class="flex items-center gap-4">
              <UAvatar
                  v-if="log.userId"
                  :alt="log.userId.username"
                  size="sm"
                  :ui="{ rounded: 'rounded-lg' }"
              />
              <div v-else class="p-2 rounded-lg bg-neutral-800 text-neutral-500">
                <UIcon name="i-heroicons-user"/>
              </div>
              <div>
                <p class="text-sm font-medium">
                  <span class="text-primary-500" v-if="log.userId">{{
                      log.userId.username
                    }}</span>
                  <span class="text-primary-500" v-else>Alguien</span>
                  <span class="text-neutral-400"> se registró para </span>
                  <span class="text-neutral-200 font-semibold">{{ log.zoomLogId?.name || log.zoomLogId?.meetingId || 'un meeting' }}</span>
                  <UBadge v-if="(log.count ?? 1) > 1" variant="subtle" color="warning" size="xs" class="ml-1 font-mono">
                    {{ log.count }}x
                  </UBadge>
                  <UBadge v-if="log.zoomLogId?.occurredAt" variant="subtle" color="primary" size="xs" class="ml-1">
                    {{ formatDateOnly(log.zoomLogId.occurredAt) }}
                  </UBadge>
                </p>
                <div class="mt-1 flex items-center gap-1.5">
                  <UIcon name="i-heroicons-clock" class="w-3.5 h-3.5 text-neutral-500" />
                  <span class="text-xs text-neutral-500 font-medium">
                    Registrado el {{ formatFullDate(log.occurredAt) }}
                  </span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <UButton v-if="log.zoomLogId?._id" :to="`/meetings/${log.zoomLogId._id}`" color="neutral" variant="ghost" size="sm"
                       icon="i-heroicons-chevron-right"/>
            </div>
          </div>
        </template>
      </div>
    </UCard>
  </div>

</template>
