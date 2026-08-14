<script setup lang="ts">
const route = useRoute()
const userId = computed(() => route.query.userId as string)

useSeoMeta({
  title: computed(() => userId.value ? 'Meetings del Usuario - STC Control' : 'Meetings - STC Control'),
  description: 'Registro de sesiones de Zoom del Stock Trading Club.',
  ogTitle: 'Meetings - STC Control',
})

const { data: meetings, pending, error, refresh } = useFetch('/api/meetings', {
  query: computed(() => ({ userId: userId.value }))
})

// Group flat list by meetingId (same Zoom ID = same recurring meeting)
const grouped = computed(() => {
  if (!meetings.value) return []
  const map = new Map<string, { name: string; meetingId: string; occurrences: any[] }>()
  for (const m of meetings.value as any[]) {
    if (!map.has(m.meetingId)) {
      map.set(m.meetingId, { name: m.name, meetingId: m.meetingId, occurrences: [] })
    }
    map.get(m.meetingId)!.occurrences.push(m)
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.occurrences[0].occurredAt).getTime() - new Date(a.occurrences[0].occurredAt).getTime()
  )
})

const totalSessions = computed(() =>
  grouped.value.reduce((n, g) => n + g.occurrences.length, 0),
)

const expanded = ref<Set<string>>(new Set())

function toggle(meetingId: string) {
  if (expanded.value.has(meetingId)) {
    expanded.value.delete(meetingId)
  } else {
    expanded.value.add(meetingId)
  }
  expanded.value = new Set(expanded.value)
}

function uniqueParticipants(occurrences: any[]) {
  const ids = new Set<string>()
  for (const occ of occurrences) {
    for (const p of occ.participants || []) {
      ids.add(p._id ?? p)
    }
  }
  return ids.size
}

// Full Spanish date + time, e.g. "miércoles, 14 de abril de 2026, 10:30 a.m."
function formatDate(date: string) {
  return new Date(date).toLocaleString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Short Spanish date for the group header, e.g. "14 abr. 2026"
function formatDateShort(date: string) {
  return new Date(date).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

watch(userId, () => refresh())
</script>

<template>
  <div class="mt-page">
    <!-- Cabecera -->
    <div class="stc-page-head">
      <div class="min-w-0">
        <div class="stc-page-title">
          {{ userId ? 'Meetings del usuario' : 'Registro de meetings' }}
        </div>
        <div v-if="userId" class="mt-filter">
          <span class="stc-page-sub" style="margin:0">Filtrando por usuario</span>
          <span class="stc-badge gold stc-mono">{{ userId }}</span>
          <NuxtLink to="/meetings" class="stc-btn sm">
            <UIcon name="i-lucide-x" class="w-3.5 h-3.5" />
            Remover filtro
          </NuxtLink>
        </div>
        <div v-else class="stc-page-sub">Sesiones de Zoom agrupadas por reunión recurrente.</div>
      </div>
      <div v-if="!pending && grouped.length" class="mt-counts">
        <span class="stc-badge neutral">{{ grouped.length }} {{ grouped.length === 1 ? 'reunión' : 'reuniones' }}</span>
        <span class="stc-badge gold">{{ totalSessions }} {{ totalSessions === 1 ? 'sesión' : 'sesiones' }}</span>
      </div>
    </div>

    <!-- Error -->
    <section v-if="error" class="stc-panel mt-alert">
      <UIcon name="i-lucide-triangle-alert" class="w-5 h-5 flex-shrink-0" />
      <div>
        <div class="mt-alert-t">Error</div>
        <p class="mt-alert-p">No se pudieron cargar los meetings: {{ error.message }}</p>
      </div>
    </section>

    <!-- Carga -->
    <section v-else-if="pending" class="stc-panel" style="padding:8px 20px">
      <div v-for="i in 6" :key="i" class="mt-sk">
        <USkeleton class="h-4 w-4 rounded flex-shrink-0" />
        <USkeleton class="h-4 w-40 sm:w-64" />
        <USkeleton class="h-5 w-16 rounded-md ml-auto" />
        <USkeleton class="h-4 w-20 hidden md:block" />
      </div>
    </section>

    <!-- Lista agrupada -->
    <section v-else class="stc-panel" style="overflow:hidden">
      <div v-if="!grouped.length" class="stc-empty">
        <UIcon name="i-lucide-inbox" />
        <p>No se encontraron meetings.</p>
      </div>

      <template v-else>
        <div v-for="group in grouped" :key="group.meetingId" class="mt-group">
          <!-- Cabecera del grupo -->
          <button
            class="mt-ghead"
            :class="{ open: expanded.has(group.meetingId) }"
            @click="toggle(group.meetingId)"
          >
            <UIcon name="i-lucide-chevron-right" class="mt-caret w-4 h-4 flex-shrink-0" />
            <span class="mt-gicon">
              <UIcon name="i-lucide-video" class="w-4 h-4" />
            </span>

            <span class="mt-gname">
              <span class="mt-gtitle">{{ group.name }}</span>
              <span class="mt-gmeta sm:hidden">
                {{ formatDateShort(group.occurrences[0].occurredAt) }}
                ·
                {{ uniqueParticipants(group.occurrences) }} participantes
              </span>
            </span>

            <span class="mt-gstats">
              <span class="mt-gpart stc-mono">
                <UIcon name="i-lucide-users" class="w-4 h-4" />
                {{ uniqueParticipants(group.occurrences) }}
              </span>
              <span class="mt-glast stc-mono">
                Última: {{ formatDateShort(group.occurrences[0].occurredAt) }}
              </span>
            </span>

            <span class="stc-badge gold flex-shrink-0">
              {{ group.occurrences.length }} sesión{{ group.occurrences.length !== 1 ? 'es' : '' }}
            </span>
          </button>

          <!-- Ocurrencias -->
          <div v-if="expanded.has(group.meetingId)" class="mt-occs">
            <div v-for="occ in group.occurrences" :key="occ._id" class="mt-occ">
              <span class="mt-occ-tick" />
              <div class="min-w-0 flex-1">
                <div class="mt-occ-date">{{ formatDate(occ.occurredAt) }}</div>
                <div class="mt-occ-sub stc-mono">
                  <UIcon name="i-lucide-users" class="w-3.5 h-3.5" />
                  {{ occ.participants?.length || 0 }} participante{{ (occ.participants?.length || 0) !== 1 ? 's' : '' }}
                </div>
              </div>
              <NuxtLink :to="`/meetings/${occ._id}`" class="stc-btn sm gold-soft flex-shrink-0">
                Ver detalles
                <UIcon name="i-lucide-arrow-up-right" class="w-3.5 h-3.5" />
              </NuxtLink>
            </div>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.mt-page { display: flex; flex-direction: column; gap: 20px; }

.mt-filter {
  display: flex;
  align-items: center;
  gap: 9px;
  flex-wrap: wrap;
  margin-top: 8px;
}
.mt-counts { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* alerta */
.mt-alert {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 18px;
  color: var(--red);
  border-color: var(--red-line);
  background: var(--red-dim);
}
.mt-alert-t { font-weight: 600; font-size: 14px; }
.mt-alert-p { font-size: 13px; color: var(--dim); margin-top: 3px; }

/* skeleton */
.mt-sk {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--line);
}
.mt-sk:last-child { border-bottom: none; }

/* grupo */
.mt-group { border-bottom: 1px solid var(--line); }
.mt-group:last-child { border-bottom: none; }

.mt-ghead {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px 20px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background .14s;
}
.mt-ghead:hover { background: rgba(255,255,255,.025); }
html:not(.dark) .mt-ghead:hover { background: rgba(0,0,0,.025); }

.mt-caret { color: var(--faint); transition: transform .18s; }
.mt-ghead.open .mt-caret { transform: rotate(90deg); color: var(--gold); }

.mt-gicon {
  width: 32px; height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  color: var(--gold);
  background: var(--gold-wash);
  border: 1px solid var(--gold-ring);
}

.mt-gname { flex: 1; min-width: 0; display: block; }
.mt-gtitle {
  display: block;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mt-gmeta {
  display: block;
  font-size: 11.5px;
  color: var(--faint);
  margin-top: 2px;
}

.mt-gstats { display: flex; align-items: center; gap: 16px; flex-shrink: 0; }
.mt-gpart {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--gold-soft);
}
.mt-glast { font-size: 11.5px; color: var(--faint); white-space: nowrap; }

/* ocurrencias */
.mt-occs {
  background: #050505;
  border-top: 1px solid var(--line);
}
html:not(.dark) .mt-occs { background: var(--inset); }

.mt-occ {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px 12px 30px;
  border-bottom: 1px solid var(--line);
}
.mt-occ:last-child { border-bottom: none; }
.mt-occ-tick {
  width: 6px; height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--gold-line);
}
.mt-occ-date {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text);
  text-transform: capitalize;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mt-occ-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--faint);
  margin-top: 3px;
}

@media (max-width: 640px) {
  .mt-gstats { display: none; }
  .mt-ghead  { padding: 13px 14px; gap: 9px; }
  .mt-occ    { padding: 11px 14px 11px 20px; flex-wrap: wrap; }
}
</style>
