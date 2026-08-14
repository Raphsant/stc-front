<script setup lang="ts">
useSeoMeta({
  title: 'Logs - STC Control',
  description: 'Historial detallado de todas las acciones del sistema y registros de usuarios.',
  ogTitle: 'Registro de Actividad - STC Control',
})

const { data: logs, pending, error } = useFetch('/api/logs')

const page  = ref(1)
const limit = ref(20)

const paginatedLogs = computed(() => {
  const start = (page.value - 1) * limit.value
  return (logs.value ?? []).slice(start, start + limit.value)
})

const total      = computed(() => logs.value?.length ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)))

watch(logs, () => { page.value = 1 })

function visiblePages(cur: number, count: number): (number | '...')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const out: (number | '...')[] = [1]
  if (cur > 3) out.push('...')
  for (let i = Math.max(2, cur - 1); i <= Math.min(count - 1, cur + 1); i++) out.push(i)
  if (cur < count - 2) out.push('...')
  out.push(count)
  return out
}

function formatFullDate(date: string | Date) {
  if (!date) return 'n/a'
  const d = new Date(date)
  const datePart = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
  const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    .toLowerCase().replace(' ', '')
  return `${datePart} ${timePart}`
}

function formatDateOnly(date: string | Date) {
  if (!date) return 'n/a'
  return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const logTypeMap: Record<string, { label: string, tone: string, icon: string }> = {
  'zoom-register':      { label: 'Registro Zoom',      tone: 'gold',    icon: 'i-lucide-video' },
  'zoom-refresh':       { label: 'Actualización Zoom', tone: 'blue',    icon: 'i-lucide-refresh-cw' },
  'discord-command':    { label: 'Comando Discord',    tone: 'neutral', icon: 'i-lucide-terminal' },
  'discord-moderation': { label: 'Moderación',         tone: 'red',     icon: 'i-lucide-shield-check' },
  'clickfunnels':       { label: 'ClickFunnels',       tone: 'green',   icon: 'i-lucide-filter' },
}

function initial(name?: string) {
  return (name || '?').replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase() || '?'
}
</script>

<template>
  <div class="lg-page">
    <!-- Cabecera -->
    <div class="stc-page-head">
      <div>
        <div class="stc-page-title">Registro de actividad</div>
        <div class="stc-page-sub">Historial detallado de las acciones del sistema y registros de usuarios.</div>
      </div>
      <span class="stc-badge gold stc-mono">
        {{ total.toLocaleString() }} {{ total === 1 ? 'registro' : 'registros' }}
      </span>
    </div>

    <!-- Error -->
    <section v-if="error" class="stc-panel lg-alert">
      <UIcon name="i-lucide-triangle-alert" class="w-5 h-5 flex-shrink-0" />
      <div>
        <div class="lg-alert-t">Error</div>
        <p class="lg-alert-p">No se pudieron cargar los logs: {{ error.message }}</p>
      </div>
    </section>

    <section v-else class="stc-panel" style="overflow:hidden">
      <!-- Carga -->
      <template v-if="pending">
        <div v-for="i in 10" :key="i" class="lg-trow lg-grid">
          <div class="flex items-center gap-3">
            <USkeleton class="w-9 h-9 rounded-lg flex-shrink-0" />
            <div class="space-y-1.5">
              <USkeleton class="h-3.5 w-28" />
              <USkeleton class="h-3 w-20" />
            </div>
          </div>
          <USkeleton class="h-5 w-28 rounded-md" />
          <div class="space-y-1.5 lg-col-meet">
            <USkeleton class="h-3.5 w-36" />
            <USkeleton class="h-3 w-24" />
          </div>
          <USkeleton class="h-3.5 w-28 lg-col-date" />
          <USkeleton class="h-5 w-8 rounded-md lg-col-count" />
          <div class="flex justify-end gap-1.5">
            <USkeleton class="w-8 h-8 rounded-lg" />
            <USkeleton class="w-8 h-8 rounded-lg" />
          </div>
        </div>
      </template>

      <!-- Vacío -->
      <div v-else-if="!paginatedLogs.length" class="stc-empty">
        <UIcon name="i-lucide-clipboard-list" />
        <p>No se encontró actividad registrada.</p>
      </div>

      <template v-else>
        <!-- Encabezados -->
        <div class="lg-thead lg-grid">
          <span class="stc-eyebrow">Usuario</span>
          <span class="stc-eyebrow">Actividad</span>
          <span class="stc-eyebrow lg-col-meet">Meeting</span>
          <span class="stc-eyebrow lg-col-date">Fecha</span>
          <span class="stc-eyebrow lg-col-count">Intentos</span>
          <span class="stc-eyebrow" style="text-align:right">Acciones</span>
        </div>

        <!-- Filas -->
        <div v-for="log in paginatedLogs" :key="log._id" class="lg-trow lg-grid">
          <!-- Usuario -->
          <div class="lg-user">
            <span class="lg-av">
              <img v-if="log.userId?.avatarUrl" :src="log.userId.avatarUrl" :alt="log.userId.username">
              <template v-else>{{ initial(log.userId?.username) }}</template>
            </span>
            <span class="min-w-0">
              <span class="lg-uname">{{ log.userId?.username || 'Usuario' }}</span>
              <span class="lg-uid stc-code">{{ log.userId?._id || log.userId || '—' }}</span>
            </span>
          </div>

          <!-- Actividad -->
          <div class="lg-types">
            <template v-for="type in log.logType" :key="type">
              <span v-if="logTypeMap[type]" class="stc-badge" :class="logTypeMap[type].tone">
                <UIcon :name="logTypeMap[type].icon" class="w-3 h-3" />
                {{ logTypeMap[type].label }}
              </span>
              <span v-else class="stc-badge neutral">{{ type }}</span>
            </template>
          </div>

          <!-- Meeting -->
          <div class="lg-col-meet min-w-0">
            <template v-if="log.zoomLogId">
              <span class="lg-meet">
                <UIcon name="i-lucide-video" class="w-3.5 h-3.5 flex-shrink-0" />
                <span class="truncate">{{ log.zoomLogId.name || log.zoomLogId.meetingId }}</span>
              </span>
              <span class="lg-meet-sub stc-mono">Meeting del {{ formatDateOnly(log.zoomLogId.occurredAt) }}</span>
            </template>
            <span v-else class="lg-na">—</span>
          </div>

          <!-- Fecha -->
          <div class="lg-col-date">
            <span class="lg-date stc-mono">{{ formatFullDate(log.occurredAt) }}</span>
          </div>

          <!-- Intentos -->
          <div class="lg-col-count">
            <span class="stc-badge stc-mono" :class="(log.count ?? 1) > 1 ? 'gold' : 'neutral'">
              {{ log.count ?? 1 }}x
            </span>
          </div>

          <!-- Acciones -->
          <div class="lg-actions">
            <NuxtLink
              v-if="log.zoomLogId?._id"
              :to="`/meetings/${log.zoomLogId._id}`"
              class="stc-icon-btn"
              title="Ver meeting"
            >
              <UIcon name="i-lucide-video" class="w-[15px] h-[15px]" />
            </NuxtLink>
            <NuxtLink
              v-if="log.userId?._id"
              :to="`/discord-users/${log.userId._id}`"
              class="stc-icon-btn"
              title="Ver usuario"
            >
              <UIcon name="i-lucide-user" class="w-[15px] h-[15px]" />
            </NuxtLink>
          </div>
        </div>

        <!-- Paginación -->
        <div v-if="total > limit" class="lg-pager">
          <button class="lg-pbtn" :disabled="page === 1" @click="page = 1">
            <UIcon name="i-lucide-chevrons-left" class="w-[15px] h-[15px]" />
          </button>
          <button class="lg-pbtn" :disabled="page === 1" @click="page--">
            <UIcon name="i-lucide-chevron-left" class="w-[15px] h-[15px]" />
          </button>
          <template v-for="(p, i) in visiblePages(page, totalPages)" :key="`${p}-${i}`">
            <span v-if="p === '...'" class="lg-pgap">…</span>
            <button v-else class="lg-pbtn" :class="{ on: p === page }" @click="page = (p as number)">{{ p }}</button>
          </template>
          <button class="lg-pbtn" :disabled="page === totalPages" @click="page++">
            <UIcon name="i-lucide-chevron-right" class="w-[15px] h-[15px]" />
          </button>
          <button class="lg-pbtn" :disabled="page === totalPages" @click="page = totalPages">
            <UIcon name="i-lucide-chevrons-right" class="w-[15px] h-[15px]" />
          </button>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.lg-page { display: flex; flex-direction: column; gap: 20px; }

/* alerta */
.lg-alert {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 18px;
  color: var(--red);
  border-color: var(--red-line);
  background: var(--red-dim);
}
.lg-alert-t { font-weight: 600; font-size: 14px; }
.lg-alert-p { font-size: 13px; color: var(--dim); margin-top: 3px; }

/* tabla */
.lg-grid {
  display: grid;
  grid-template-columns:
    minmax(190px, 1.5fr) minmax(150px, 1.2fr) minmax(170px, 1.4fr)
    minmax(130px, .9fr) 80px 84px;
  align-items: center;
  gap: 14px;
}
.lg-thead { padding: 14px 22px; border-bottom: 1px solid var(--line); }
.lg-trow {
  padding: 12px 22px;
  border-bottom: 1px solid var(--line);
  transition: background .14s;
}
.lg-trow:last-of-type { border-bottom: none; }
.lg-trow:hover { background: rgba(255,255,255,.022); }
html:not(.dark) .lg-trow:hover { background: rgba(0,0,0,.02); }

/* usuario */
.lg-user { display: flex; align-items: center; gap: 11px; min-width: 0; }
.lg-av {
  width: 34px; height: 34px;
  border-radius: 8px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  font-family: var(--disp);
  font-weight: 800;
  font-size: 16px;
  color: var(--text);
  background: #161616;
  border: 1px solid var(--line);
}
html:not(.dark) .lg-av { background: #2a2a2a; color: #f0f0f0; }
.lg-av img { width: 100%; height: 100%; object-fit: cover; }
.lg-uname {
  display: block;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lg-uid {
  display: block;
  font-size: 10.5px;
  color: var(--faint);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lg-types { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }

/* meeting */
.lg-meet {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  min-width: 0;
}
.lg-meet :deep(.iconify) { color: var(--gold); }
.lg-meet-sub { display: block; font-size: 11px; color: var(--faint); margin-top: 2px; }
.lg-na { font-size: 13px; color: var(--faint); }

.lg-date { font-size: 12px; color: var(--dim); white-space: nowrap; }

.lg-actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }

/* paginación */
.lg-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 18px 22px;
  border-top: 1px solid var(--line);
}
.lg-pbtn {
  min-width: 34px; height: 34px;
  padding: 0 10px;
  display: grid;
  place-items: center;
  border-radius: 7px;
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
  font-size: 12.5px;
  color: var(--dim);
  border: 1px solid var(--line);
  background: transparent;
  cursor: pointer;
  transition: .14s;
}
.lg-pbtn:hover:not(:disabled):not(.on) {
  color: var(--text);
  border-color: var(--line-2);
  background: rgba(255,255,255,.03);
}
html:not(.dark) .lg-pbtn:hover:not(:disabled):not(.on) { background: rgba(0,0,0,.03); }
.lg-pbtn.on {
  color: var(--gold-ink);
  font-weight: 700;
  background: var(--gold);
  border-color: var(--gold);
}
.lg-pbtn:disabled { opacity: .35; cursor: not-allowed; }
.lg-pgap { min-width: 22px; text-align: center; color: var(--faint); font-size: 12.5px; }

/* responsive */
@media (max-width: 1280px) {
  .lg-grid {
    grid-template-columns: minmax(180px, 1.5fr) minmax(150px, 1.2fr) minmax(170px, 1.4fr) 84px;
  }
  .lg-col-date, .lg-col-count { display: none; }
}
@media (max-width: 900px) {
  .lg-grid { grid-template-columns: minmax(170px, 1.4fr) minmax(140px, 1fr) 84px; }
  .lg-col-meet { display: none; }
}
@media (max-width: 640px) {
  .lg-thead { display: none; }
  .lg-trow.lg-grid {
    grid-template-columns: 1fr auto;
    gap: 8px 10px;
    padding: 14px 16px;
    align-items: start;
  }
  .lg-user    { grid-column: 1; grid-row: 1; }
  .lg-types   { grid-column: 1; grid-row: 2; }
  .lg-actions { grid-column: 2; grid-row: 1 / 3; align-self: center; flex-direction: column; }
  .lg-pager   { gap: 5px; padding: 16px 12px; }
  .lg-pbtn    { min-width: 30px; height: 30px; font-size: 12px; }
}
</style>
