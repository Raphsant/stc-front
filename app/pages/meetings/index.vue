<script setup lang="ts">
const badgeVariant = useBadgeVariant()
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
  <div class="p-4 sm:p-6">
    <div class="mb-6 sm:mb-8">
      <h1 class="text-2xl sm:text-3xl font-bold  dark:text-white">
        {{ userId ? 'Meetings del Usuario' : 'Registro de Meetings' }}
      </h1>
      <p v-if="userId" class="text-neutral-400 mt-1 flex flex-wrap items-center gap-2 text-sm">
        Filtrando por usuario:
        <UBadge :variant="badgeVariant" size="sm" color="primary">{{ userId }}</UBadge>
        <UButton to="/meetings" icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="xs" label="Remover filtro" />
      </p>
    </div>

    <div v-if="error" class="mb-6">
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        title="Error"
        :description="`No se pudieron cargar los meetings: ${error.message}`"
      />
    </div>

    <!-- Skeleton -->
    <UCard v-if="pending" class="dark:bg-neutral-900/50 dark:border-neutral-800">
      <div class="space-y-3">
        <div v-for="i in 6" :key="i" class="flex items-center gap-3 p-2">
          <USkeleton class="h-4 w-4 rounded shrink-0" />
          <USkeleton class="h-4 w-4 rounded shrink-0" />
          <USkeleton class="h-4 w-40 sm:w-64" />
          <USkeleton class="h-5 w-10 rounded-full ml-auto" />
          <USkeleton class="h-4 w-6 hidden sm:block" />
          <USkeleton class="h-4 w-20 hidden md:block" />
        </div>
      </div>
    </UCard>

    <!-- Grouped list -->
    <UCard v-else class="dark:bg-neutral-900/50 dark:border-neutral-800 overflow-hidden p-0">
      <div v-if="!grouped.length" class="flex flex-col items-center justify-center py-12 text-neutral-500">
        <UIcon name="i-heroicons-inbox" class="w-10 h-10 mb-2" />
        <p>No se encontraron meetings.</p>
      </div>

      <div v-else class="divide-y divide-cream-400 dark:divide-neutral-800">
        <div v-for="group in grouped" :key="group.meetingId">

          <!-- Group header -->
          <button
            class="w-full flex items-center gap-3 px-4 py-4 hover:bg-cream-300/40 dark:hover:bg-neutral-800/40 transition-colors text-left"
            @click="toggle(group.meetingId)"
          >
            <UIcon
              :name="expanded.has(group.meetingId) ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
              class="w-4 h-4 text-neutral-500 shrink-0"
            />
            <UIcon name="i-heroicons-video-camera" class="w-4 h-4 text-primary-500 shrink-0" />

            <!-- Name + mobile meta -->
            <div class="flex-1 min-w-0">
              <span class="font-medium text-neutral-900 dark:text-neutral-100 truncate block">{{ group.name }}</span>
              <!-- Mobile-only secondary line -->
              <div class="flex items-center gap-2 mt-0.5 sm:hidden">
                <span class="text-xs text-neutral-500">{{ formatDateShort(group.occurrences[0].occurredAt) }}</span>
                <span class="text-neutral-700">·</span>
                <span class="text-xs text-neutral-500">{{ uniqueParticipants(group.occurrences) }} participantes</span>
              </div>
            </div>

            <!-- Desktop meta -->
            <div class="hidden sm:flex items-center gap-4 shrink-0">
              <div class="flex items-center gap-1.5 text-primary-400 text-sm">
                <UIcon name="i-heroicons-users" class="w-5 h-5" />
                <span>{{ uniqueParticipants(group.occurrences) }}</span>
              </div>
              <span class="text-xs text-neutral-600 dark:text-neutral-300">
                Última: {{ formatDateShort(group.occurrences[0].occurredAt) }}
              </span>
            </div>

            <UBadge color="primary" :variant="badgeVariant" size="sm" class="shrink-0">
              {{ group.occurrences.length }} sesión{{ group.occurrences.length !== 1 ? 'es' : '' }}
            </UBadge>
          </button>

          <!-- Occurrences -->
          <div v-if="expanded.has(group.meetingId)" class="bg-cream-100/60 dark:bg-neutral-950/60 border-t border-cream-400/60 dark:border-neutral-800/60">
            <div
              v-for="occ in group.occurrences"
              :key="occ._id"
              class="flex items-center gap-3 px-4 sm:px-8 py-3 border-b border-cream-400/30 dark:border-neutral-800/30 last:border-0"
            >
              <!-- Indent line -->
              <div class="w-px h-6 bg-cream-400 dark:bg-neutral-700 shrink-0 hidden sm:block" />

              <!-- Date info -->
              <div class="flex-1 min-w-0">
                <p class="text-sm text-neutral-800 dark:text-neutral-200 font-medium capitalize truncate">
                  {{ formatDate(occ.occurredAt) }}
                </p>
                <div class="flex items-center gap-1.5 mt-0.5 text-sm ">
                  <UIcon name="i-heroicons-users" class="w-5 h-5 text-primary-500" />
                  <span>{{ occ.participants?.length || 0 }} participante{{ (occ.participants?.length || 0) !== 1 ? 's' : '' }}</span>
                </div>
              </div>

              <!-- Action button -->
              <UButton
                :to="`/meetings/${occ._id}`"
                color="primary"
                :variant="badgeVariant"
                size="xs"
                icon="i-heroicons-arrow-top-right-on-square"
                label="Ver detalles"
                class="shrink-0"
              />
            </div>
          </div>

        </div>
      </div>
    </UCard>
  </div>
</template>
