<script setup lang="ts">
useSeoMeta({
  title: 'Dashboard - STC Control',
  description: 'Panel de control del Stock Trading Club.',
  ogTitle: 'Dashboard - STC Control',
})

const nuxtApp = useNuxtApp()

// ── data fetches ───────────────────────────────────────────
const { data: discordInfo, pending: discordPending } = await useFetch(
  'https://stc.snuuy.com/webhooks/discord-info',
  {
    method: 'GET',
    key: 'discord-info',
    getCachedData(key) { return nuxtApp.payload.data[key] || nuxtApp.static.data[key] },
  },
)

const { data: membersTrend, pending: membersTrendPending } = await useFetch(
  '/api/discord-users/trend',
  { lazy: true, default: () => ({ total: 0, deltaPct: 0, series: [] as number[] }) },
)

const { data: meetingsTrend, pending: meetingsTrendPending } = await useFetch(
  '/api/meetings/trend',
  { lazy: true, default: () => ({ total: 0, delta: 0, series: [] as number[] }) },
)

const { data: botStatus, pending: statusPending } = useBotStatus()
const { data: logs, pending: logsPending } = await useFetch('/api/logs', { query: { limit: 6 }, lazy: true })

// ── chart period state ────────────────────────────────────
type Period = 'diario' | 'semanal' | 'mensual'
const period    = ref<Period>('diario')
const chartFrom = ref('')
const chartTo   = ref('')

const periodMap: Record<Period, string> = { diario: 'daily', semanal: 'weekly', mensual: 'monthly' }

const { data: stats, pending: statsPending } = useFetch('/api/logs/stats', {
  query: computed(() => ({
    period: periodMap[period.value],
    ...(chartFrom.value ? { from: chartFrom.value } : {}),
    ...(chartTo.value   ? { to:   chartTo.value   } : {}),
  })),
  lazy: true,
  default: () => [],
})

const chartData = computed(() =>
  (stats.value || []).map((e: any) => ({ label: e.date, value: e.count })),
)

// ── derived UI helpers ────────────────────────────────────
const botIsUp = computed(() => botStatus.value?.status === 'UP')
const discordConnected = computed(() => botStatus.value?.discord === 'Connected')

function formatUptime(seconds: number) {
  if (!seconds) return '0m'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  if (m > 0 || parts.length === 0) parts.push(`${m}m`)
  return parts.join(' ')
}

function formatTime(date: string | Date) {
  if (!date) return '—'
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).toLowerCase().replace(' ', '')
}
function formatDateShort(date: string | Date) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  })
}
</script>

<template>
  <!-- ── Console status strip ────────────────────────────── -->
  <section class="stc-panel stc-console">
    <div class="stc-cseg identity">
      <div class="stc-id-glyph">
        <UIcon name="i-lucide-server" class="w-5 h-5" />
      </div>
      <div class="min-w-0">
        <div class="stc-display truncate" style="font-size:24px; letter-spacing:.02em; text-transform:uppercase">
          <USkeleton v-if="discordPending" class="h-5 w-44" />
          <template v-else>{{ discordInfo?.guildName ?? 'STC' }}</template>
        </div>
        <div class="stc-mono truncate" style="font-size:13px; color:var(--dim); margin-top:2px">
          <USkeleton v-if="discordPending || meetingsTrendPending" class="h-3 w-36 mt-1" />
          <template v-else>
            {{ (discordInfo?.memberCount ?? membersTrend.total).toLocaleString() }} miembros · {{ meetingsTrend.total.toLocaleString() }} meetings
          </template>
        </div>
      </div>
    </div>

    <div class="stc-cseg">
      <span class="stc-eyebrow">Estado del Bot</span>
      <span class="stc-cval" :class="{ green: botIsUp }">
        <USkeleton v-if="statusPending" class="h-4 w-16" />
        <template v-else>
          <span v-if="botIsUp" class="stc-dot green" />
          <span v-else class="stc-dot red" />
          {{ botIsUp ? 'ACTIVO' : 'OFFLINE' }}
        </template>
      </span>
    </div>

    <div class="stc-cseg">
      <span class="stc-eyebrow">Uptime</span>
      <span class="stc-cval">
        <USkeleton v-if="statusPending" class="h-4 w-12" />
        <template v-else>{{ formatUptime(botStatus?.uptime) }}</template>
      </span>
    </div>

    <div class="stc-cseg">
      <span class="stc-eyebrow">Discord</span>
      <span class="stc-cval" :class="{ green: discordConnected }">
        <USkeleton v-if="statusPending" class="h-4 w-20" />
        <template v-else>
          <span v-if="discordConnected" class="stc-dot green" />
          <span v-else class="stc-dot red" />
          {{ discordConnected ? 'Conectado' : 'Desconectado' }}
        </template>
      </span>
    </div>

    <div class="stc-cseg">
      <span class="stc-eyebrow">Servicio</span>
      <span class="stc-cval" :class="{ green: botIsUp }">
        <USkeleton v-if="statusPending" class="h-4 w-20" />
        <template v-else>
          <span v-if="botIsUp" class="stc-dot green" />
          <span v-else class="stc-dot red" />
          {{ botIsUp ? 'En línea' : 'Fuera de servicio' }}
        </template>
      </span>
    </div>
  </section>

  <!-- ── Chart + metric rail ─────────────────────────────── -->
  <section class="stc-grid-main">

    <!-- Chart panel -->
    <div class="stc-panel stc-chart-panel">
      <div class="flex items-start justify-between flex-wrap" style="gap:16px">
        <div>
          <div class="stc-panel-title">Registros por período</div>
          <div class="stc-eyebrow" style="margin-top:5px">Nuevos registros a meetings</div>
        </div>
        <div class="flex items-end flex-wrap" style="gap:14px">
          <div class="stc-seg">
            <button
              v-for="p in (['diario','semanal','mensual'] as Period[])"
              :key="p"
              :class="{ on: period === p }"
              @click="period = p"
            >
              {{ p.charAt(0).toUpperCase() + p.slice(1) }}
            </button>
          </div>
          <div class="stc-dfield">
            <label>Desde</label>
            <input v-model="chartFrom" type="date" />
          </div>
          <div class="stc-dfield">
            <label>Hasta</label>
            <input v-model="chartTo" type="date" />
          </div>
          <button
            v-if="chartFrom || chartTo"
            class="stc-top-icon"
            style="width:30px; height:30px; border-radius:7px; margin-bottom:1px"
            @click="chartFrom = ''; chartTo = ''"
            title="Limpiar filtro"
          >
            <UIcon name="i-lucide-x" class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div v-if="statsPending" style="margin-top:16px">
        <USkeleton class="w-full" style="height:320px; border-radius:8px" />
      </div>
      <div v-else-if="!chartData.length" class="flex items-center justify-center" style="height:320px; margin-top:16px">
        <span style="font-size:13px; color:var(--faint)">No hay datos para este período.</span>
      </div>
      <ClientOnly v-else>
        <StcChart :data="chartData" :height="320" />
      </ClientOnly>
    </div>

    <!-- Right rail: metric tiles -->
    <div class="stc-rail">
      <div class="stc-panel stc-tile">
        <div class="stc-tile-head">
          <span class="lbl">Miembros Totales</span>
          <UIcon name="i-lucide-users" class="w-4 h-4" />
        </div>
        <div class="stc-tile-val">
          <USkeleton v-if="membersTrendPending" class="h-8 w-24" />
          <template v-else>{{ membersTrend.total.toLocaleString() }}</template>
        </div>
        <div class="stc-tile-foot">
          <USkeleton v-if="membersTrendPending" class="h-5 w-12 rounded-md" />
          <template v-else>
            <span class="stc-delta" :class="membersTrend.deltaPct >= 0 ? 'up' : 'down'">
              <UIcon
                :name="membersTrend.deltaPct >= 0 ? 'i-lucide-arrow-up-right' : 'i-lucide-arrow-down-right'"
                class="w-3 h-3"
              />
              {{ Math.abs(membersTrend.deltaPct).toFixed(1) }}%
            </span>
            <span class="stc-delta-note">vs. semana previa</span>
          </template>
        </div>
        <ClientOnly>
          <StcSparkline v-if="!membersTrendPending && membersTrend.series.length > 1" :data="membersTrend.series" />
        </ClientOnly>
      </div>

      <div class="stc-panel stc-tile">
        <div class="stc-tile-head">
          <span class="lbl">Meetings Registrados</span>
          <UIcon name="i-lucide-video" class="w-4 h-4" />
        </div>
        <div class="stc-tile-val">
          <USkeleton v-if="meetingsTrendPending" class="h-8 w-20" />
          <template v-else>{{ meetingsTrend.total.toLocaleString() }}</template>
        </div>
        <div class="stc-tile-foot">
          <USkeleton v-if="meetingsTrendPending" class="h-5 w-10 rounded-md" />
          <template v-else>
            <span class="stc-delta" :class="meetingsTrend.delta >= 0 ? 'up' : 'down'">
              <UIcon
                :name="meetingsTrend.delta >= 0 ? 'i-lucide-arrow-up-right' : 'i-lucide-arrow-down-right'"
                class="w-3 h-3"
              />
              {{ Math.abs(meetingsTrend.delta) }}
            </span>
            <span class="stc-delta-note">en los últimos 7 días</span>
          </template>
        </div>
        <ClientOnly>
          <StcSparkline v-if="!meetingsTrendPending && meetingsTrend.series.length > 1" :data="meetingsTrend.series" />
        </ClientOnly>
      </div>
    </div>
  </section>

  <!-- ── Activity feed ───────────────────────────────────── -->
  <section class="stc-panel stc-act-panel">
    <div class="stc-act-head">
      <h2 class="stc-panel-title">Actividad Reciente</h2>
      <NuxtLink to="/logs" class="stc-link-all">
        Ver Todo
        <UIcon name="i-lucide-arrow-right" class="w-3 h-3" />
      </NuxtLink>
    </div>

    <!-- Skeleton -->
    <div v-if="logsPending" class="stc-feed">
      <div v-for="i in 6" :key="i" class="stc-fitem">
        <USkeleton class="w-[34px] h-[34px] rounded-lg flex-shrink-0" />
        <div class="flex-1 space-y-1.5">
          <USkeleton class="h-3.5 w-3/4 rounded" />
          <USkeleton class="h-3 w-24 rounded" />
        </div>
        <div class="flex flex-col items-end gap-1">
          <USkeleton class="h-3 w-12 rounded" />
          <USkeleton class="h-3 w-16 rounded" />
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="!logs?.length" class="py-8 text-center" style="font-size:13px; color:var(--faint)">
      No hay actividad reciente.
    </div>

    <!-- Feed -->
    <div v-else class="stc-feed">
      <div v-for="log in logs" :key="log._id" class="stc-fitem">
        <div class="stc-fav">
          <img
            v-if="log.userId?.avatarUrl"
            :src="log.userId.avatarUrl"
            :alt="log.userId.username"
          />
          <template v-else>{{ (log.userId?.username ?? '?').charAt(0).toUpperCase() }}</template>
        </div>
        <div class="stc-fbody">
          <div class="fl">
            <b>{{ log.userId?.username ?? 'Alguien' }}</b>
            se registró para
            <span class="tag">{{ log.zoomLogId?.name || log.zoomLogId?.meetingId || 'un meeting' }}</span>
          </div>
          <div class="stc-ftype">Registro de meeting</div>
        </div>
        <div class="stc-ftime">
          {{ formatTime(log.occurredAt) }}
          <span class="d">{{ formatDateShort(log.occurredAt) }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.stc-grid-main {
  display: grid;
  grid-template-columns: minmax(0, 1.92fr) minmax(282px, 1fr);
  gap: 18px;
  align-items: stretch;
}
.stc-rail {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
@media (max-width: 1080px) {
  .stc-grid-main { grid-template-columns: 1fr; }
  .stc-rail { flex-direction: row; }
}
@media (max-width: 720px) {
  .stc-rail { flex-direction: column; }
}
</style>
