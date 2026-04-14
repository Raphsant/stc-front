<script setup lang="ts">
const { data: logs, pending, error } = useFetch('/api/logs', {
  query: { limit: 50 }
})

const columns = [
  {
    accessorKey: 'userId',
    header: 'Usuario',
    class: 'px-2 sm:px-4'
  },
  {
    accessorKey: 'logType',
    header: 'Actividad',
    class: 'hidden sm:table-cell'
  },
  {
    accessorKey: 'meetingId',
    header: 'Meeting',
    class: 'px-2 sm:px-4'
  },
  {
    accessorKey: 'occurredAt',
    header: 'Fecha',
    class: 'hidden lg:table-cell'
  },
  {
    accessorKey: 'count',
    header: 'Intentos',
    class: 'hidden sm:table-cell'
  },
  {
    id: 'actions',
    header: '',
    class: 'px-2 sm:px-4'
  }
]

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

const logTypeMap: Record<string, { label: string, color: any, icon: string }> = {
  'zoom-register': { label: 'Registro Zoom', color: 'primary', icon: 'i-heroicons-video-camera' },
  'zoom-refresh': { label: 'Actualización Zoom', color: 'blue', icon: 'i-heroicons-arrow-path' },
  'discord-command': { label: 'Comando Discord', color: 'indigo', icon: 'i-heroicons-command-line' },
  'discord-moderation': { label: 'Moderación', color: 'red', icon: 'i-heroicons-shield-check' },
  'clickfunnels': { label: 'ClickFunnels', color: 'orange', icon: 'i-heroicons-funnel' }
}
</script>

<template>
  <div class="p-6">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Registro de Actividad</h1>
      <p class="text-gray-500 mt-1">Historial detallado de todas las acciones del sistema y registros de usuarios.</p>
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

    <UCard v-else class="bg-neutral-900/50 border-neutral-800">
      <UTable
        :data="logs || []"
        :columns="columns"
        class="w-full"
      >
        <!-- User Column -->
        <template #userId-cell="{ row }">
          <div class="flex items-center gap-2 sm:gap-3 py-1">
            <UAvatar
              v-if="row.original.userId"
              :alt="row.original.userId.username"
              size="xs"
              class="sm:size-sm"

            />
            <div v-else class="p-1.5 sm:p-2 rounded-lg bg-neutral-800 text-neutral-500">
              <UIcon name="i-heroicons-user" class="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
            <div class="flex flex-col min-w-0">
              <span class="font-medium text-gray-900 dark:text-white text-xs sm:text-sm truncate">{{ row.original.userId?.username || 'Usuario' }}</span>
              <span class="text-[10px] sm:text-xs text-neutral-500 font-mono truncate hidden sm:block">{{ row.original.userId?._id || row.original.userId }}</span>
              <div class="sm:hidden flex mt-0.5">
                <span v-for="type in row.original.logType" :key="type" class="text-[9px] uppercase font-bold text-primary-500/80 tracking-wider">
                  {{ logTypeMap[type]?.label || type }}
                </span>
              </div>
            </div>
          </div>
        </template>

        <!-- Log Type Column -->
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
              <UBadge v-else color="neutral" variant="subtle" size="sm">
                {{ type }}
              </UBadge>
            </template>
          </div>
        </template>

        <!-- Meeting Column -->
        <template #meetingId-cell="{ row }">
          <div v-if="row.original.meetingId" class="flex flex-col min-w-0">
            <div class="flex items-center gap-1 font-medium text-gray-900 dark:text-white text-xs sm:text-sm truncate">
              <UIcon name="i-heroicons-video-camera" class="text-primary-500 w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
              <span class="truncate">{{ row.original.meetingId.name || row.original.meetingId.meetingId }}</span>
            </div>
            <div class="text-[10px] sm:text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
              <UIcon name="i-heroicons-calendar" class="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span class="sm:hidden">{{ formatDateOnly(row.original.meetingId.occurredAt).split('/')[0] + '/' + formatDateOnly(row.original.meetingId.occurredAt).split('/')[1] }}</span>
              <span class="hidden sm:inline">Meeting del {{ formatDateOnly(row.original.meetingId.occurredAt) }}</span>
            </div>
            <div class="lg:hidden text-[9px] text-neutral-500 mt-0.5 font-medium italic">
              {{ formatFullDate(row.original.occurredAt) }}
            </div>
          </div>
          <span v-else class="text-neutral-500 text-[10px] sm:text-sm italic">N/A</span>
        </template>

        <!-- Count Column -->
        <template #count-cell="{ row }">
          <div class="flex items-center gap-1.5">
            <UBadge
              :color="(row.original.count ?? 1) > 1 ? 'warning' : 'neutral'"
              :variant="(row.original.count ?? 1) > 1 ? 'subtle' : 'soft'"
              size="sm"
              class="font-mono tabular-nums"
            >
              {{ row.original.count ?? 1 }}x
            </UBadge>
          </div>
        </template>

        <!-- Registration Date Column -->
        <template #occurredAt-cell="{ row }">
          <div class="flex items-center gap-2 text-neutral-400 text-sm">
            <UIcon name="i-heroicons-clock" class="w-4 h-4" />
            {{ formatFullDate(row.original.occurredAt) }}
          </div>
        </template>

        <!-- Actions Column -->
        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-2">
            <UTooltip text="Ver Meeting" v-if="row.original.meetingId?._id">
              <UButton
                :to="`/meetings/${row.original.meetingId._id}`"
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
    </UCard>
  </div>
</template>
