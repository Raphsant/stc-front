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

const total = computed(() => logs.value?.length ?? 0)

watch(logs, () => { page.value = 1 })

const columns = [
  { accessorKey: 'userId',     header: 'Usuario',   class: 'px-2 sm:px-4' },
  { accessorKey: 'logType',    header: 'Actividad', class: 'hidden sm:table-cell' },
  { accessorKey: 'zoomLogId',  header: 'Meeting',   class: 'px-2 sm:px-4' },
  { accessorKey: 'occurredAt', header: 'Fecha',     class: 'hidden lg:table-cell' },
  { accessorKey: 'count',      header: 'Intentos',  class: 'hidden sm:table-cell' },
  { id: 'actions',             header: '',          class: 'px-2 sm:px-4' },
]

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

const logTypeMap: Record<string, { label: string, color: any, icon: string }> = {
  'zoom-register':      { label: 'Registro Zoom',      color: 'primary', icon: 'i-heroicons-video-camera' },
  'zoom-refresh':       { label: 'Actualización Zoom', color: 'blue',    icon: 'i-heroicons-arrow-path' },
  'discord-command':    { label: 'Comando Discord',    color: 'indigo',  icon: 'i-heroicons-command-line' },
  'discord-moderation': { label: 'Moderación',         color: 'red',     icon: 'i-heroicons-shield-check' },
  'clickfunnels':       { label: 'ClickFunnels',       color: 'orange',  icon: 'i-heroicons-funnel' },
}
</script>

<template>
  <div class="p-4 sm:p-6">
    <div class="mb-6 sm:mb-8 flex justify-between items-start">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Registro de Actividad</h1>
        <p class="text-gray-500 mt-1 text-sm sm:text-base">Historial detallado de todas las acciones del sistema y registros de usuarios.</p>
      </div>
      <span class="text-sm text-gray-400 mt-1">{{ total }} {{ total === 1 ? 'registro' : 'registros' }}</span>
    </div>

    <div v-if="error" class="mb-6">
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        title="Error"
        :description="`No se pudieron cargar los logs: ${error.message}`"
      />
    </div>

    <!-- Skeleton -->
    <UCard v-if="pending" class="bg-neutral-900/50 border-neutral-800">
      <div class="space-y-4">
        <div v-for="i in 10" :key="i" class="flex items-center gap-4">
          <USkeleton class="h-8 w-8 rounded-lg shrink-0" />
          <div class="space-y-1.5 flex-1">
            <USkeleton class="h-3.5 w-28" />
            <USkeleton class="h-3 w-20" />
          </div>
          <USkeleton class="h-5 w-24 rounded-full hidden sm:block" />
          <div class="hidden sm:flex flex-col gap-1">
            <USkeleton class="h-3.5 w-32" />
            <USkeleton class="h-3 w-20" />
          </div>
          <USkeleton class="h-3.5 w-24 hidden lg:block" />
          <div class="flex gap-1 ml-auto">
            <USkeleton class="h-7 w-7 rounded-md" />
            <USkeleton class="h-7 w-7 rounded-md" />
          </div>
        </div>
      </div>
    </UCard>

    <template v-else>
      <!-- ── MOBILE card list (< md) ── -->
      <div class="md:hidden">
        <div v-if="!paginatedLogs.length" class="flex flex-col items-center justify-center py-12 text-gray-500">
          <UIcon name="i-heroicons-clipboard-document-list" class="text-4xl mb-2" />
          <p class="text-sm">No se encontró actividad registrada.</p>
        </div>

        <div v-else class="flex flex-col gap-3">
          <UCard
            v-for="log in paginatedLogs"
            :key="log._id"
            class="bg-neutral-900/50 border-neutral-800"
          >
            <div class="flex items-start gap-3">
              <UAvatar
                v-if="log.userId"
                :alt="log.userId.username"
                size="sm"
                :ui="{ rounded: 'rounded-lg' }"
                class="shrink-0 mt-0.5"
              />
              <div v-else class="p-2 rounded-lg bg-neutral-800 text-neutral-500 shrink-0 mt-0.5">
                <UIcon name="i-heroicons-user" class="w-4 h-4" />
              </div>

              <div class="flex-1 min-w-0 space-y-1.5">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-semibold text-sm text-white truncate">
                    {{ log.userId?.username || 'Usuario' }}
                  </span>
                  <template v-for="type in log.logType" :key="type">
                    <UBadge
                      v-if="logTypeMap[type]"
                      :color="logTypeMap[type].color"
                      variant="subtle"
                      size="xs"
                      class="flex items-center gap-1"
                    >
                      <UIcon :name="logTypeMap[type].icon" class="w-2.5 h-2.5" />
                      {{ logTypeMap[type].label }}
                    </UBadge>
                  </template>
                  <UBadge v-if="(log.count ?? 1) > 1" color="warning" variant="subtle" size="xs" class="font-mono">
                    {{ log.count }}x
                  </UBadge>
                </div>

                <div v-if="log.zoomLogId" class="flex items-center gap-1.5 text-xs text-neutral-400">
                  <UIcon name="i-heroicons-video-camera" class="w-3.5 h-3.5 text-primary-500 shrink-0" />
                  <span class="truncate">{{ log.zoomLogId.name || log.zoomLogId.meetingId }}</span>
                  <span class="text-neutral-600">·</span>
                  <span class="shrink-0">{{ formatDateOnly(log.zoomLogId.occurredAt) }}</span>
                </div>

                <div class="flex items-center gap-1.5 text-xs text-neutral-500">
                  <UIcon name="i-heroicons-clock" class="w-3.5 h-3.5 shrink-0" />
                  {{ formatFullDate(log.occurredAt) }}
                </div>
              </div>

              <div class="flex flex-col gap-1 shrink-0">
                <UButton
                  v-if="log.zoomLogId?._id"
                  :to="`/meetings/${log.zoomLogId._id}`"
                  icon="i-heroicons-video-camera"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                />
                <UButton
                  v-if="log.userId?._id"
                  :to="`/discord-users/${log.userId._id}`"
                  icon="i-heroicons-user"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                />
              </div>
            </div>
          </UCard>
        </div>

        <div v-if="total > limit" class="flex justify-center mt-6">
          <UPagination v-model:page="page" :total="total" :items-per-page="limit" />
        </div>
      </div>

      <!-- ── DESKTOP table (≥ md) ── -->
      <UCard class="hidden md:block bg-neutral-900/50 border-neutral-800">
        <UTable :data="paginatedLogs" :columns="columns" class="w-full">

          <template #userId-cell="{ row }">
            <div class="flex items-center gap-2 sm:gap-3 py-1">
              <UAvatar
                v-if="row.original.userId"
                :alt="row.original.userId.username"
                size="xs"
              />
              <div v-else class="p-1.5 sm:p-2 rounded-lg bg-neutral-800 text-neutral-500">
                <UIcon name="i-heroicons-user" class="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
              <div class="flex flex-col min-w-0">
                <span class="font-medium text-gray-900 dark:text-white text-xs sm:text-sm truncate">
                  {{ row.original.userId?.username || 'Usuario' }}
                </span>
                <span class="text-[10px] sm:text-xs text-neutral-500 font-mono truncate hidden sm:block">
                  {{ row.original.userId?._id || row.original.userId }}
                </span>
              </div>
            </div>
          </template>

          <template #logType-cell="{ row }">
            <div class="flex flex-wrap gap-1">
              <template v-for="type in row.original.logType" :key="type">
                <UBadge
                  v-if="logTypeMap[type]"
                  :color="logTypeMap[type].color"
                  variant="subtle"
                  size="sm"
                  class="flex items-center gap-1"
                >
                  <UIcon :name="logTypeMap[type].icon" class="w-3 h-3" />
                  {{ logTypeMap[type].label }}
                </UBadge>
                <UBadge v-else color="neutral" variant="subtle" size="sm">{{ type }}</UBadge>
              </template>
            </div>
          </template>

          <template #zoomLogId-cell="{ row }">
            <div v-if="row.original.zoomLogId" class="flex flex-col min-w-0">
              <div class="flex items-center gap-1 font-medium text-gray-900 dark:text-white text-xs sm:text-sm truncate">
                <UIcon name="i-heroicons-video-camera" class="text-primary-500 w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                <span class="truncate">{{ row.original.zoomLogId.name || row.original.zoomLogId.meetingId }}</span>
              </div>
              <div class="text-[10px] sm:text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                <UIcon name="i-heroicons-calendar" class="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                <span>Meeting del {{ formatDateOnly(row.original.zoomLogId.occurredAt) }}</span>
              </div>
            </div>
            <span v-else class="text-neutral-500 text-sm italic">N/A</span>
          </template>

          <template #count-cell="{ row }">
            <UBadge
              :color="(row.original.count ?? 1) > 1 ? 'warning' : 'neutral'"
              :variant="(row.original.count ?? 1) > 1 ? 'subtle' : 'soft'"
              size="sm"
              class="font-mono tabular-nums"
            >
              {{ row.original.count ?? 1 }}x
            </UBadge>
          </template>

          <template #occurredAt-cell="{ row }">
            <div class="flex items-center gap-2 text-neutral-400 text-sm">
              <UIcon name="i-heroicons-clock" class="w-4 h-4" />
              {{ formatFullDate(row.original.occurredAt) }}
            </div>
          </template>

          <template #actions-cell="{ row }">
            <div class="flex justify-end gap-2">
              <UTooltip text="Ver Meeting" v-if="row.original.zoomLogId?._id">
                <UButton
                  :to="`/meetings/${row.original.zoomLogId._id}`"
                  icon="i-heroicons-arrow-top-right-on-square"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                />
              </UTooltip>
              <UTooltip text="Ver Usuario" v-if="row.original.userId?._id">
                <UButton
                  :to="`/discord-users/${row.original.userId._id}`"
                  icon="i-heroicons-user"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                />
              </UTooltip>
            </div>
          </template>

          <template #empty-state>
            <div class="flex flex-col items-center justify-center py-12 text-gray-500">
              <UIcon name="i-heroicons-clipboard-document-list" class="text-4xl mb-2" />
              <p>No se encontró actividad registrada.</p>
            </div>
          </template>
        </UTable>

        <div v-if="total > limit" class="flex justify-center border-t border-gray-200 dark:border-gray-800 py-4">
          <UPagination v-model:page="page" :total="total" :items-per-page="limit" />
        </div>
      </UCard>
    </template>
  </div>
</template>
